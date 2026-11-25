import { env } from '../config/env.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Citation {
  chunk_id: string
  document_id: string
  chunk_index: number
  snippet: string
  similarity_score: number
}

export interface RagChatPayload {
  company_id: string
  query: string
  top_k?: number | undefined
  threshold?: number | undefined
  chat_history?: ChatMessage[] | undefined
  document_ids?: string[] | undefined
}

export interface RagChatResponseData {
  query: string
  answer: string
  citations: Citation[]
  model: string
  grounded: boolean
}

export class RagServiceError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode = 502, code = 'AI_SERVICE_ERROR') {
    super(message)
    this.name = 'RagServiceError'
    this.statusCode = statusCode
    this.code = code
  }
}

/**
 * Forward authenticated RAG chat requests to the Python AI service.
 */
export async function sendRagChat(payload: RagChatPayload): Promise<RagChatResponseData> {
  const url = `${env.AI_SERVICE_URL}/api/v1/chat`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorMessage = `AI service returned HTTP ${response.status}`
      try {
        const errorJson = (await response.json()) as { detail?: string }
        if (errorJson.detail) {
          errorMessage = errorJson.detail
        }
      } catch {
        // Fall back to HTTP status message
      }

      throw new RagServiceError(
        `RAG generation failed: ${errorMessage}`,
        response.status >= 500 ? 502 : response.status,
        'AI_SERVICE_ERROR',
      )
    }

    const json = (await response.json()) as {
      success: boolean
      data: RagChatResponseData
    }

    return json.data
  } catch (err: unknown) {
    if (err instanceof RagServiceError) {
      throw err
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw new RagServiceError('AI service request timed out after 30 seconds.', 504, 'AI_TIMEOUT')
    }

    const message = err instanceof Error ? err.message : 'Unknown communication error'
    throw new RagServiceError(
      `Unable to communicate with AI service at ${env.AI_SERVICE_URL}: ${message}`,
      503,
      'AI_SERVICE_UNAVAILABLE',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
