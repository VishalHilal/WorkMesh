export interface Citation {
  chunk_id: string
  document_id: string
  chunk_index: number
  snippet: string
  similarity_score: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  model?: string
  grounded?: boolean
  timestamp: string
}

export interface RagChatResponse {
  success: boolean
  data: {
    query: string
    answer: string
    citations: Citation[]
    model: string
    grounded: boolean
  }
  meta: {
    timestamp: string
  }
}
