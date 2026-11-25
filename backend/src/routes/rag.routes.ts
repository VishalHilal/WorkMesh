import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { sendRagChat, RagServiceError } from '../services/rag.service.js'
import { recordAuditEvent } from '../lib/audit.js'

const ragRouter = Router()

// All RAG routes require authentication
ragRouter.use(authenticate)

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty'),
})

const ragChatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Query cannot be empty')
    .max(4000, 'Query cannot exceed 4000 characters'),
  top_k: z.coerce.number().int().min(1).max(20).default(5),
  threshold: z.coerce.number().min(0).max(1).default(0.4),
  chat_history: z.array(chatMessageSchema).optional(),
  document_ids: z.array(z.string().min(1)).optional(),
})

/**
 * POST /api/v1/rag/chat
 * Tenant-scoped RAG question answering over company documents.
 */
ragRouter.post('/chat', async (req: Request, res: Response) => {
  const companyId = getAuthenticatedCompanyId(req)

  const parseResult = ragChatRequestSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid RAG chat request payload.',
        details: parseResult.error.flatten().fieldErrors,
      },
      meta: { timestamp: new Date().toISOString() },
    })
    return
  }

  const { query, top_k, threshold, chat_history, document_ids } = parseResult.data

  try {
    const chatData = await sendRagChat({
      company_id: companyId,
      query,
      top_k,
      threshold,
      chat_history,
      document_ids,
    })

    res.status(200).json({
      success: true,
      data: chatData,
      meta: { timestamp: new Date().toISOString() },
    })

    void recordAuditEvent({
      companyId,
      userId: req.user?.userId,
      action: 'RAG_QUERY_EXECUTED',
      entityType: 'RagChat',
      details: {
        queryLength: query.length,
        citationsCount: chatData.citations?.length ?? 0,
        top_k,
        threshold,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    })
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const message = err instanceof Error ? err.message : 'Internal RAG error'
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: `An unexpected error occurred while processing the RAG request: ${message}`,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  }
})

export { ragRouter }
