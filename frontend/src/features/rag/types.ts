export interface Citation {
  chunk_id: string
  document_id: string
  chunk_index: number
  snippet: string
  similarity_score: number
}

export interface EmailDraftPayload {
  approval_token: string
  to: string
  subject: string
  body: string
  cc: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  model?: string
  grounded?: boolean
  timestamp: string
  agentHandled?: 'knowledge_agent' | 'office_agent' | 'supervisor' | string
  agentPath?: string[]
  iterations?: number
  mode?: 'rag' | 'agent'
  draft_payload?: EmailDraftPayload
}

export interface ConversationThreadItem {
  id: string
  companyId: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  _count?: {
    messages: number
  }
}

export interface ThreadMessageItem {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[] | null
  createdAt: string
}

export interface ThreadDetail extends ConversationThreadItem {
  messages: ThreadMessageItem[]
}

export interface RagChatResponse {
  success: boolean
  data: {
    query: string
    answer: string
    citations: Citation[]
    model: string
    grounded: boolean
    thread_id?: string
    threadId?: string
    agentHandled?: 'knowledge_agent' | 'office_agent' | 'supervisor' | string
    agentPath?: string[]
    iterations?: number
    mode?: 'rag' | 'agent'
    draft_payload?: EmailDraftPayload
  }
  meta: {
    timestamp: string
  }
}
