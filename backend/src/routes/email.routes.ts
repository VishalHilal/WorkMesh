import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db.js'
import { recordAuditEvent } from '../lib/audit.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { generateEmailDraft, AgentServiceError } from '../services/agent.service.js'

const emailRouter = Router()

emailRouter.use(authenticate)

const draftRequestSchema = z.object({
  instruction: z.string().trim().min(1, 'Instruction is required.'),
  context: z.string().trim().optional(),
})

const approvalTokenSchema = z.object({
  approval_token: z.string().uuid('approval_token must be a valid UUID.'),
})

/**
 * POST /api/v1/agents/email/draft
 * Generate a structured email draft via AI service and persist it as PENDING.
 */
emailRouter.post('/draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId

    const parsed = draftRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email draft request.',
          details: parsed.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const aiResult = await generateEmailDraft({
      company_id: companyId,
      instruction: parsed.data.instruction,
      context: parsed.data.context,
    })

    await prisma.emailDraft.create({
      data: {
        companyId,
        userId,
        approvalToken: aiResult.approval_token,
        to: aiResult.draft.to,
        subject: aiResult.draft.subject,
        body: aiResult.draft.body,
        cc: aiResult.draft.cc,
        status: 'PENDING',
      },
    })

    recordAuditEvent({
      companyId,
      userId,
      action: 'EMAIL_DRAFT_CREATED',
      entityType: 'EmailDraft',
      entityId: aiResult.approval_token,
      details: { to: aiResult.draft.to, subject: aiResult.draft.subject },
      ipAddress: req.ip ?? null,
    }).catch(() => {})

    res.status(200).json({
      success: true,
      data: aiResult,
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
 * Shared handler for approving or rejecting a company-scoped email draft.
 */
async function handleDecision(
  req: Request,
  res: Response,
  next: NextFunction,
  targetStatus: 'APPROVED' | 'REJECTED'
): Promise<void> {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId

    const parsed = approvalTokenSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid approval token.',
          details: parsed.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { approval_token } = parsed.data

    const existing = await prisma.emailDraft.findFirst({
      where: {
        approvalToken: approval_token,
        companyId,
      },
    })

    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Email draft not found for this company.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    if (existing.status !== 'PENDING') {
      res.status(409).json({
        error: {
          code: 'ALREADY_PROCESSED',
          message: `Email draft has already been ${existing.status.toLowerCase()}.`,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    await prisma.emailDraft.updateMany({
      where: {
        id: existing.id,
        companyId,
        status: 'PENDING',
      },
      data: { status: targetStatus },
    })

    recordAuditEvent({
      companyId,
      userId,
      action: targetStatus === 'APPROVED' ? 'EMAIL_DRAFT_APPROVED' : 'EMAIL_DRAFT_REJECTED',
      entityType: 'EmailDraft',
      entityId: approval_token,
      details: { to: existing.to, subject: existing.subject },
      ipAddress: req.ip ?? null,
    }).catch(() => {})

    if (targetStatus === 'APPROVED') {
      res.status(200).json({
        success: true,
        message: 'Email approved and queued for send',
      })
      return
    }

    res.status(200).json({ success: true })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/agents/email/approve
 */
emailRouter.post('/approve', (req, res, next) => handleDecision(req, res, next, 'APPROVED'))

/**
 * POST /api/v1/agents/email/reject
 */
emailRouter.post('/reject', (req, res, next) => handleDecision(req, res, next, 'REJECTED'))

export { emailRouter }
