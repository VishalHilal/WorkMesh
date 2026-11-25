import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { recordAuditEvent } from '../lib/audit.js'
import { uploadObject, deleteObject, getPresignedDownloadUrl } from '../lib/storage.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { AgentServiceError } from '../services/agent.service.js'
import { generateAiReport } from '../services/report.service.js'

const reportRouter = Router()
reportRouter.use(authenticate)

const generateReportSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  prompt: z.string().trim().min(1, 'Prompt is required.'),
  format: z.enum(['pdf', 'docx']).default('pdf'),
  template: z
    .enum(['executive_summary', 'policy_brief', 'compliance_audit'])
    .default('executive_summary'),
  document_ids: z.array(z.string().min(1)).optional(),
})

const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
})

/**
 * POST /api/v1/reports/generate
 * Synthesize report via AI service, upload artifact to private S3, persist metadata.
 */
reportRouter.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId

    const parsed = generateReportSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid report generation payload.',
          details: parsed.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { title, prompt, format, template, document_ids } = parsed.data

    const aiReport = await generateAiReport({
      company_id: companyId,
      title,
      prompt,
      format,
      template,
      document_ids,
    })

    const fileBuffer = Buffer.from(aiReport.content_base64, 'base64')
    const sanitizedName = aiReport.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `reports/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizedName}`

    await uploadObject(storageKey, fileBuffer, aiReport.mime_type)

    const report = await prisma.generatedReport.create({
      data: {
        companyId,
        userId,
        title: aiReport.title,
        format: format === 'docx' ? 'DOCX' : 'PDF',
        template: aiReport.template,
        fileName: aiReport.file_name,
        mimeType: aiReport.mime_type,
        fileSize: fileBuffer.length,
        storageKey,
      },
    })

    recordAuditEvent({
      companyId,
      userId,
      action: 'REPORT_GENERATED',
      entityType: 'GeneratedReport',
      entityId: report.id,
      details: { title: report.title, format: report.format, template: report.template },
      ipAddress: req.ip ?? null,
    }).catch(() => {})

    res.status(201).json({
      success: true,
      data: {
        ...report,
        citations: aiReport.citations,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    if (err instanceof AgentServiceError) {
      res.status(err.statusCode).json({
        error: { code: err.code, message: err.message },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }
    next(err)
  }
})

/**
 * GET /api/v1/reports
 * List generated reports strictly scoped to the caller's company.
 */
reportRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const parsed = listReportsQuerySchema.safeParse(req.query)

    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination query parameters.',
          details: parsed.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { page, limit } = parsed.data
    const skip = (page - 1) * limit

    const [total, reports] = await Promise.all([
      prisma.generatedReport.count({ where: { companyId } }),
      prisma.generatedReport.findMany({
        where: { companyId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.status(200).json({
      success: true,
      data: reports,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/reports/:id/download
 * Issue a short-lived presigned URL after verifying company ownership.
 */
reportRouter.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId
    const reportId = String(req.params['id'] ?? '')

    const report = await prisma.generatedReport.findFirst({
      where: { id: reportId, companyId },
    })

    if (!report) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Report not found for this company.' },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const expiresInSeconds = 300
    const downloadUrl = await getPresignedDownloadUrl(report.storageKey, expiresInSeconds)

    recordAuditEvent({
      companyId,
      userId,
      action: 'REPORT_DOWNLOADED',
      entityType: 'GeneratedReport',
      entityId: report.id,
      details: { fileName: report.fileName, format: report.format },
      ipAddress: req.ip ?? null,
    }).catch(() => {})

    res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        fileName: report.fileName,
        expiresInSeconds,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/reports/:id
 * Delete a report from storage and PostgreSQL (uploader or ADMIN/SUPER_ADMIN only).
 */
reportRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId
    const userRole = req.user!.role
    const reportId = String(req.params['id'] ?? '')

    const report = await prisma.generatedReport.findFirst({
      where: { id: reportId, companyId },
    })

    if (!report) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Report not found for this company.' },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN
    if (report.userId !== userId && !isAdmin) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the report creator or an Administrator can delete this report.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    await deleteObject(report.storageKey).catch(() => {})
    await prisma.generatedReport.delete({ where: { id: report.id } })

    recordAuditEvent({
      companyId,
      userId,
      action: 'REPORT_DELETED',
      entityType: 'GeneratedReport',
      entityId: report.id,
      details: { title: report.title },
      ipAddress: req.ip ?? null,
    }).catch(() => {})

    res.status(200).json({
      success: true,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

export { reportRouter }
