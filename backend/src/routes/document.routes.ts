import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { DocumentStatus, Role } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { env } from '../config/env.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import {
  uploadObject,
  deleteObject,
  getPresignedDownloadUrl,
  buildStorageKey,
} from '../lib/storage.js'

const documentsRouter = Router()

// All document routes require authentication
documentsRouter.use(authenticate)

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('INVALID_FILE_TYPE'))
    }
  },
}).single('file')

function handleUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds the 10MB limit.',
          },
          meta: { timestamp: new Date().toISOString() },
        })
        return
      }
      res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    if (err) {
      if (err.message === 'INVALID_FILE_TYPE') {
        res.status(400).json({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Unsupported file type. Only PDF, DOCX, and TXT files are allowed.',
          },
          meta: { timestamp: new Date().toISOString() },
        })
        return
      }
      next(err)
      return
    }

    next()
  })
}

const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(DocumentStatus).optional(),
})

// POST /api/v1/documents/upload — upload a single document
documentsRouter.post('/upload', handleUploadMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const uploadedById = req.user!.userId

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'FILE_REQUIRED',
          message: 'A file is required for upload.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const title = typeof req.body?.title === 'string' && req.body.title.trim().length > 0
      ? req.body.title.trim()
      : req.file.originalname

    const storageKey = buildStorageKey(companyId, req.file.originalname)

    // Upload to Neon Object Storage
    await uploadObject(storageKey, req.file.buffer, req.file.mimetype)

    // Persist document metadata in PostgreSQL
    const document = await prisma.document.create({
      data: {
        companyId,
        uploadedById,
        title,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storageKey,
        status: DocumentStatus.PENDING,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Trigger AI service ingestion asynchronously in the background
    const aiServiceUrl = env.AI_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://localhost:8000'
    fetch(`${aiServiceUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        document_id: document.id,
        company_id: companyId,
        storage_key: storageKey,
        file_name: req.file.originalname,
      }),
    }).catch(() => {
      // Non-blocking trigger — failure to reach AI service won't fail the upload response
    })

    res.status(201).json({
      data: document,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/documents — list documents for caller's company
documentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const query = listDocumentsQuerySchema.safeParse(req.query)

    if (!query.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: query.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { page, limit, status } = query.data
    const skip = (page - 1) * limit

    const where = {
      companyId,
      ...(status ? { status } : {}),
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ])

    res.status(200).json({
      data: documents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/documents/:id — get document details and presigned download URL
documentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const id = req.params.id as string

    const document = await prisma.document.findFirst({
      where: {
        id,
        companyId, // strictly enforce tenant isolation
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!document) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    let downloadUrl: string | null = null
    try {
      downloadUrl = await getPresignedDownloadUrl(document.storageKey, 3600)
    } catch {
      // Storage unavailable or error generating URL
    }

    res.status(200).json({
      data: {
        ...document,
        downloadUrl,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/documents/:id — delete document from storage and database
documentsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const id = req.params.id as string

    const document = await prisma.document.findFirst({
      where: {
        id,
        companyId, // strictly enforce tenant isolation
      },
    })

    if (!document) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Role check: Caller must be ADMIN, SUPER_ADMIN, or the original uploader
    const userRole = req.user!.role
    const isUploader = document.uploadedById === req.user!.userId
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN

    if (!isAdmin && !isUploader) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this document.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Best-effort delete from Neon Object Storage
    try {
      await deleteObject(document.storageKey)
    } catch {
      // Do not block database record cleanup if file was already removed
    }

    // Delete database record
    await prisma.document.delete({
      where: { id: document.id },
    })

    res.status(200).json({
      data: {
        message: 'Document deleted successfully.',
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/documents/:id/retry — re-trigger document ingestion for PENDING or FAILED documents
documentsRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const id = req.params.id as string

    const document = await prisma.document.findFirst({
      where: {
        id,
        companyId, // strictly enforce tenant isolation
      },
    })

    if (!document) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Role check: Caller must be ADMIN, SUPER_ADMIN, or the original uploader
    const userRole = req.user!.role
    const isUploader = document.uploadedById === req.user!.userId
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN

    if (!isAdmin && !isUploader) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to retry ingestion for this document.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Status check: Only PENDING or FAILED documents can be retried
    if (document.status === DocumentStatus.READY || document.status === DocumentStatus.PROCESSING) {
      res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot retry document in ${document.status} status. Only PENDING or FAILED documents can be retried.`,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Transition document status to PROCESSING and clear error message
    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.PROCESSING,
        errorMessage: null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Trigger AI service ingestion asynchronously in the background
    const aiServiceUrl = env.AI_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://localhost:8000'
    fetch(`${aiServiceUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        document_id: document.id,
        company_id: companyId,
        storage_key: document.storageKey,
        file_name: document.fileName,
      }),
    }).catch(() => {
      // Non-blocking trigger — failure to reach AI service won't fail the retry response
    })

    res.status(200).json({
      success: true,
      data: updatedDocument,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

export { documentsRouter }
