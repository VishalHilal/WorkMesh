import { env } from '../config/env.js'

export interface AgentRunPayload {
  company_id: string
  query: string
  chat_history?: Array<{ role: 'user' | 'assistant'; content: string }> | undefined
  document_ids?: string[] | undefined
}

export interface AgentCitation {
  chunk_id: string
  document_id: string
  chunk_index: number
  snippet: string
  similarity_score: number
}

export interface AgentRunResponseData {
  answer: string
  agent_handled: 'knowledge_agent' | 'office_agent' | 'supervisor' | string
  agent_path: string[]
  citations: AgentCitation[]
  iterations: number
}

export class AgentServiceError extends Error {
  public statusCode: number
  public code: string

  constructor(message: string, statusCode = 502, code = 'AI_SERVICE_ERROR') {
    super(message)
    this.name = 'AgentServiceError'
    this.statusCode = statusCode
    this.code = code
  }
}

/**
 * Forward authenticated multi-agent supervisor requests to the Python AI service.
 */
export async function runSupervisorAgent(payload: AgentRunPayload): Promise<AgentRunResponseData> {
  const url = `${env.AI_SERVICE_URL}/api/v1/agents/run`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 35000)

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

      throw new AgentServiceError(
        errorMessage,
        response.status === 401 ? 500 : response.status,
        'AGENT_SERVICE_ERROR'
      )
    }

    const responseData = (await response.json()) as {
      success: boolean
      data: AgentRunResponseData
    }

    if (!responseData.success || !responseData.data) {
      throw new AgentServiceError('Invalid response payload from AI agent service', 502)
    }

    return responseData.data
  } catch (err: unknown) {
    if (err instanceof AgentServiceError) {
      throw err
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw new AgentServiceError(
        'Request to AI service timed out after 35 seconds',
        504,
        'AI_SERVICE_TIMEOUT'
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown network failure'
    throw new AgentServiceError(
      `Unable to communicate with AI agent service at ${env.AI_SERVICE_URL}: ${message}`,
      503,
      'AI_SERVICE_UNAVAILABLE'
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
