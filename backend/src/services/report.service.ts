import { env } from '../config/env.js'
import { AgentServiceError } from './agent.service.js'

export interface ReportGeneratePayload {
  company_id: string
  title: string
  prompt: string
  format: 'pdf' | 'docx'
  template?: 'executive_summary' | 'policy_brief' | 'compliance_audit' | undefined
  document_ids?: string[] | undefined
}

export interface ReportGenerateAiResult {
  title: string
  format: 'pdf' | 'docx'
  template: string
  file_name: string
  mime_type: string
  file_size: number
  content_base64: string
  citations: Array<{
    chunk_id: string
    document_id: string
    chunk_index: number
    snippet: string
    similarity_score: number
  }>
}

/**
 * Forward authenticated report synthesis request to the Python AI service.
 */
export async function generateAiReport(
  payload: ReportGeneratePayload
): Promise<ReportGenerateAiResult> {
  const url = `${env.AI_SERVICE_URL}/api/v1/reports/generate`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)

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
        // Fall back to HTTP status
      }
      throw new AgentServiceError(
        errorMessage,
        response.status === 401 ? 500 : response.status,
        'REPORT_SERVICE_ERROR'
      )
    }

    const body = (await response.json()) as {
      success: boolean
      data: ReportGenerateAiResult
    }

    if (!body.success || !body.data) {
      throw new AgentServiceError('Invalid response payload from AI report service', 502)
    }

    return body.data
  } catch (err: unknown) {
    if (err instanceof AgentServiceError) {
      throw err
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AgentServiceError('Report generation timed out after 45 seconds', 504, 'AI_SERVICE_TIMEOUT')
    }
    const message = err instanceof Error ? err.message : 'Unknown network failure'
    throw new AgentServiceError(
      `Unable to communicate with AI report service at ${env.AI_SERVICE_URL}: ${message}`,
      503,
      'AI_SERVICE_UNAVAILABLE'
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
