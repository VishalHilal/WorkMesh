import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useAuth } from '../../context'
import { AppHeader } from '../../components/AppHeader'
import { SourceDrawer } from './SourceDrawer'
import type { ChatMessage, Citation, RagChatResponse } from './types'
import {
  SparklesIcon,
  SendIcon,
  ShieldCheckIcon,
  DocumentIcon,
  RefreshIcon,
} from '../../components/icons'

const STARTER_PROMPTS = [
  'What is our sick leave and annual vacation policy?',
  'How do employees submit expense reports for reimbursement?',
  'What are the mandatory information security guidelines?',
  'Summarize our core code of conduct and remote work rules.',
]

export function KnowledgeAssistantPage() {
  const { user, accessToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change or loading state toggles
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSendQuery = async (queryText: string) => {
    const trimmed = queryText.trim()
    if (!trimmed || !accessToken || isLoading) return

    setError(null)
    const userMsgId = `user-${crypto.randomUUID()}`
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    // Add user message to conversation
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Build chat history context for multi-turn RAG
    const chatHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const response = await fetch('/api/v1/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: trimmed,
          top_k: 5,
          threshold: 0.4,
          chat_history: chatHistory,
        }),
      })

      const result = (await response.json()) as RagChatResponse & { error?: { message?: string } }

      if (!response.ok) {
        throw new Error(result.error?.message ?? 'Failed to receive answer from knowledge assistant.')
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: result.data.answer,
        citations: result.data.citations,
        model: result.data.model,
        grounded: result.data.grounded,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(message)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSendQuery(inputValue)
  }

  const handleReset = () => {
    setMessages([])
    setError(null)
    setInputValue('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Enterprise Unified Header */}
      <AppHeader currentTab="assistant" />

      {/* Main Chat Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col min-h-0">
        {/* Top Header Bar */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Knowledge Assistant
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Grounded RAG
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tenant AI semantic search synthesized from company documents.
              </p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 self-start sm:self-auto"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              <span>New Conversation</span>
            </button>
          )}
        </div>

        {/* Message Stream Area */}
        <div
          role="region"
          aria-label="Conversation messages"
          className="flex-1 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-y-auto p-4 sm:p-6 space-y-6 min-h-[420px]"
        >
          {/* Empty Welcome State */}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs mb-4">
                <SparklesIcon className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Ask anything about company knowledge
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                Hello {user?.firstName ?? 'Employee'}! The assistant searches all company policy documents,
                handbooks, and technical files, generating verified answers with direct citations.
              </p>

              {/* Starter Prompts */}
              <div className="mt-8 w-full space-y-2 text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                  Suggested Questions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendQuery(prompt)}
                      className="p-3 text-xs text-left bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-xl text-slate-700 hover:text-indigo-900 transition-all font-medium flex items-start gap-2 shadow-2xs group"
                    >
                      <DocumentIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conversation Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {message.role === 'user' ? (
                // User Query Bubble
                <div className="max-w-2xl bg-indigo-600 text-white rounded-2xl rounded-tr-xs px-4.5 py-3 text-sm shadow-xs font-medium">
                  {message.content}
                </div>
              ) : (
                // Assistant Answer Card
                <div className="max-w-3xl w-full bg-slate-50/80 border border-slate-200 rounded-2xl rounded-tl-xs p-5 space-y-4 shadow-2xs">
                  {/* Top Meta Bar */}
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                        <SparklesIcon className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">WorkMesh Assistant</span>
                      {message.model && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/80 text-slate-600">
                          {message.model}
                        </span>
                      )}
                    </div>

                    {message.grounded && (
                      <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        <span>Grounded in Company Knowledge</span>
                      </div>
                    )}
                  </div>

                  {/* Main Answer Content */}
                  <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-normal">
                    {message.content}
                  </div>

                  {/* Grounded Source Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="pt-3 border-t border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Verified Document Sources ({message.citations.length})
                        </span>
                        <span className="text-[10px] text-slate-400">Click to view source excerpt</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {message.citations.map((citation, idx) => {
                          const percent = Math.round(citation.similarity_score * 100)
                          return (
                            <button
                              key={citation.chunk_id || idx}
                              type="button"
                              onClick={() => setSelectedCitation(citation)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-900 transition-all shadow-2xs group"
                            >
                              <DocumentIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                              <span className="font-medium">
                                [{idx + 1}] Chunk #{citation.chunk_index + 1}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                {percent}%
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Active Generation Indicator */}
          {isLoading && (
            <div className="flex items-start">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-4.5 space-y-2 shadow-2xs flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                  <SparklesIcon className="w-3 h-3" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800">
                    Searching company vector space & synthesizing answer...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Retrieving matching chunks with gemini-embedding-2 and synthesizing with Gemini Flash
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-[11px] font-semibold text-rose-700 hover:underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Box */}
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="relative flex items-center bg-white border border-slate-300 rounded-xl shadow-2xs focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20 transition-all p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your company's documents..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-hidden disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-2xs"
            >
              <SendIcon className="w-3.5 h-3.5 mr-1" />
              <span>Send</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Answers are synthesized strictly from verified documents within your company space.
          </p>
        </form>

        {/* Slide-out Source Citation Inspector Drawer */}
        <SourceDrawer
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      </main>
    </div>
  )
}
