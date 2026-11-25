import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { sendRagChat, RagServiceError } from '../services/rag.service.js'
import { runSupervisorAgent, AgentServiceError } from '../services/agent.service.js'
import { recordAuditEvent } from '../lib/audit.js'

const ragRouter = Router()

// All RAG routes require authentication
ragRouter.use(authenticate)

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty'),
})

const createThreadSchema = z.object({
  title: z.string().trim().max(120).optional(),
})

const updateThreadSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(120, 'Title cannot exceed 120 characters'),
})

const ragChatRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Query cannot be empty')
    .max(4000, 'Query cannot exceed 4000 characters'),
  thread_id: z.string().trim().optional(),
  top_k: z.coerce.number().int().min(1).max(20).default(5),
  threshold: z.coerce.number().min(0).max(1).default(0.4),
  chat_history: z.array(chatMessageSchema).optional(),
  document_ids: z.array(z.string().min(1)).optional(),
  mode: z.enum(['agent', 'rag']).optional().default('agent'),
})

/**
 * GET /api/v1/rag/threads
 * List conversation threads for caller within their tenant company.
 */
ragRouter.get('/threads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId

    const threads = await prisma.conversationThread.findMany({
      where: {
        companyId,
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    res.status(200).json({
      success: true,
      data: threads,
      meta: {
        total: threads.length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/rag/threads
 * Create a new conversation thread.
 */
ragRouter.post('/threads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId

    const parseResult = createThreadSchema.safeParse(req.body ?? {})
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid thread creation payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const title = parseResult.data.title?.trim() || 'New Conversation'

    const thread = await prisma.conversationThread.create({
      data: {
        companyId,
        userId,
        title,
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    res.status(201).json({
      success: true,
      data: thread,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/rag/threads/:id
 * Retrieve a specific thread with its ordered chat messages and citations.
 */
ragRouter.get('/threads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId
    const id = req.params.id as string

    const thread = await prisma.conversationThread.findFirst({
      where: {
        id,
        companyId,
        userId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!thread) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation thread not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    res.status(200).json({
      success: true,
      data: thread,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /api/v1/rag/threads/:id
 * Rename a conversation thread title.
 */
ragRouter.patch('/threads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId
    const id = req.params.id as string

    const parseResult = updateThreadSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid thread update payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const existing = await prisma.conversationThread.findFirst({
      where: { id, companyId, userId },
    })

    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation thread not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const updated = await prisma.conversationThread.update({
      where: { id },
      data: { title: parseResult.data.title },
    })

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/rag/threads/:id
 * Delete a conversation thread and all its messages.
 */
ragRouter.delete('/threads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const userId = req.user!.userId
    const id = req.params.id as string

    const existing = await prisma.conversationThread.findFirst({
      where: { id, companyId, userId },
    })

    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation thread not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    await prisma.conversationThread.delete({
      where: { id },
    })

    res.status(200).json({
      success: true,
      data: { message: 'Conversation thread deleted successfully.' },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/rag/chat
 * Tenant-scoped RAG question answering over company documents with thread history persistence.
 */
ragRouter.post('/chat', async (req: Request, res: Response) => {
  const companyId = getAuthenticatedCompanyId(req)
  const userId = req.user!.userId

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

  const { query, thread_id, top_k, threshold, chat_history, document_ids, mode } = parseResult.data

  let activeThreadId = thread_id
  let historyToSend = chat_history

  // If a thread_id is specified, verify ownership and optionally load recent messages
  if (activeThreadId) {
    const thread = await prisma.conversationThread.findFirst({
      where: {
        id: activeThreadId,
        companyId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!thread) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation thread not found.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // If client didn't supply inline chat_history, use the persistent thread messages
    if (!historyToSend && thread.messages.length > 0) {
      historyToSend = thread.messages
        .reverse()
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
    }
  } else {
    // Automatically create a new thread for this conversation session
    try {
      const autoTitle = query.length > 35 ? `${query.slice(0, 35).trim()}…` : query.trim()
      const newThread = await prisma.conversationThread.create({
        data: {
          companyId,
          userId,
          title: autoTitle || 'New Conversation',
        },
      })
      activeThreadId = newThread.id
    } catch (createErr) {
      console.warn('Failed to auto-create conversation thread:', createErr)
    }
  }

  try {
    let chatData: {
      query: string
      answer: string
      citations: Array<{
        chunk_id: string
        document_id: string
        chunk_index: number
        snippet: string
        similarity_score: number
      }>
      model: string
      grounded: boolean
      agentHandled: string
      agentPath: string[]
      iterations: number
      mode: 'agent' | 'rag'
    }

    if (mode === 'agent') {
      const agentResult = await runSupervisorAgent({
        company_id: companyId,
        query,
        chat_history: historyToSend,
        document_ids,
      })

      chatData = {
        query,
        answer: agentResult.answer,
        citations: agentResult.citations || [],
        model: 'gemini-2.5-flash',
        grounded: (agentResult.citations && agentResult.citations.length > 0) || false,
        agentHandled: agentResult.agent_handled,
        agentPath: agentResult.agent_path,
        iterations: agentResult.iterations,
        mode: 'agent',
      }
    } else {
      const ragResult = await sendRagChat({
        company_id: companyId,
        query,
        top_k,
        threshold,
        chat_history: historyToSend,
        document_ids,
      })

      chatData = {
        query: ragResult.query,
        answer: ragResult.answer,
        citations: ragResult.citations || [],
        model: ragResult.model,
        grounded: ragResult.grounded,
        agentHandled: 'knowledge_agent',
        agentPath: ['knowledge_agent'],
        iterations: 1,
        mode: 'rag',
      }
    }

    // Persist user message and assistant answer to thread
    if (activeThreadId) {
      try {
        await prisma.$transaction([
          prisma.threadMessage.create({
            data: {
              threadId: activeThreadId,
              role: 'user',
              content: query,
            },
          }),
          prisma.threadMessage.create({
            data: {
              threadId: activeThreadId,
              role: 'assistant',
              content: chatData.answer,
              citations: (chatData.citations as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            },
          }),
          prisma.conversationThread.update({
            where: { id: activeThreadId },
            data: { updatedAt: new Date() },
          }),
        ])
      } catch (saveErr) {
        console.warn('Failed to persist thread message:', saveErr)
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...chatData,
        thread_id: activeThreadId,
        threadId: activeThreadId,
      },
      meta: { timestamp: new Date().toISOString() },
    })

    if (mode === 'agent') {
      void recordAuditEvent({
        companyId,
        userId,
        action: 'AGENT_WORKFLOW_EXECUTED',
        entityType: 'AgentChat',
        entityId: activeThreadId ?? null,
        details: {
          queryLength: query.length,
          agentHandled: chatData.agentHandled,
          agentPath: chatData.agentPath,
          iterations: chatData.iterations,
          citationsCount: chatData.citations?.length ?? 0,
          threadId: activeThreadId ?? null,
          mode: 'agent',
        },
        ipAddress: req.ip || req.socket.remoteAddress,
      }).catch(() => {})
    } else {
      void recordAuditEvent({
        companyId,
        userId,
        action: 'RAG_QUERY_EXECUTED',
        entityType: 'RagChat',
        entityId: activeThreadId ?? null,
        details: {
          queryLength: query.length,
          citationsCount: chatData.citations?.length ?? 0,
          threadId: activeThreadId ?? null,
          top_k,
          threshold,
          mode: 'rag',
        },
        ipAddress: req.ip || req.socket.remoteAddress,
      }).catch(() => {})
    }
  } catch (err: unknown) {
    if (err instanceof RagServiceError || err instanceof AgentServiceError) {
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
