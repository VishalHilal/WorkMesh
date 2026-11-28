import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Sparkles,
  Send,
  ShieldCheck,
  FileText,
  RotateCcw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Info,
  CornerDownRight,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Loader2,
  Bot,
  BookOpen,
  FileEdit,
  Workflow,
} from 'lucide-react'
import { useAuth } from '../../context'
import { AppShell } from '../../components/AppShell'
import { SourceDrawer } from './SourceDrawer'
import { EmailDraftPanel } from './EmailDraftPanel'
import type { ChatMessage, Citation, ConversationThreadItem, ThreadDetail, RagChatResponse } from './types'

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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({})
  const [chatMode, setChatMode] = useState<'agent' | 'rag'>('agent')

  // Conversation Threads State
  const [threads, setThreads] = useState<ConversationThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [searchThread, setSearchThread] = useState('')
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isLoadingThreads, setIsLoadingThreads] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch threads for authenticated user
  const fetchThreads = useCallback(async () => {
    if (!accessToken) return
    setIsLoadingThreads(true)
    try {
      const res = await fetch('/api/v1/rag/threads', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const body = await res.json()
        setThreads(body.data || [])
      }
    } catch {
      // Best-effort fetch
    } finally {
      setIsLoadingThreads(false)
    }
  }, [accessToken])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchThreads()
    }, 50)
    return () => clearTimeout(timer)
  }, [fetchThreads])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Select and load a thread
  const handleSelectThread = async (threadId: string) => {
    if (threadId === activeThreadId || !accessToken) return
    setError(null)
    setIsLoading(true)
    setActiveThreadId(threadId)

    try {
      const res = await fetch(`/api/v1/rag/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body: { success: boolean; data: ThreadDetail } = await res.json()
      if (!res.ok) {
        throw new Error('Failed to load conversation thread.')
      }

      const loadedMessages: ChatMessage[] = (body.data.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: (m.citations as Citation[] | null) || undefined,
        timestamp: m.createdAt,
      }))

      setMessages(loadedMessages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading conversation.')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  // Start a fresh conversation
  const handleNewChat = () => {
    setActiveThreadId(null)
    setMessages([])
    setError(null)
    setInputValue('')
    inputRef.current?.focus()
  }

  // Delete a thread
  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken) return

    try {
      const res = await fetch(`/api/v1/rag/threads/${threadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        if (activeThreadId === threadId) {
          handleNewChat()
        }
      }
    } catch {
      // Best-effort delete
    }
  }

  // Save renamed thread title
  const handleSaveRename = async (threadId: string, e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!editingTitle.trim() || !accessToken) {
      setEditingThreadId(null)
      return
    }

    try {
      const res = await fetch(`/api/v1/rag/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
      if (res.ok) {
        const body = await res.json()
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: body.data.title } : t))
        )
      }
    } catch {
      // Best-effort rename
    } finally {
      setEditingThreadId(null)
    }
  }

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Ignore
    }
  }

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

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Build chat history context
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
          thread_id: activeThreadId || undefined,
          top_k: 5,
          threshold: 0.4,
          chat_history: chatHistory,
          mode: chatMode,
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
        agentHandled: result.data.agentHandled,
        agentPath: result.data.agentPath,
        iterations: result.data.iterations,
        mode: result.data.mode || chatMode,
        ...(result.data.draft_payload ? { draft_payload: result.data.draft_payload } : {}),
      }

      setMessages((prev) => [...prev, assistantMsg])

      // If a new thread was created on the backend, update active state & list
      if (result.data.thread_id && result.data.thread_id !== activeThreadId) {
        const newId = result.data.thread_id
        setActiveThreadId(newId)
        fetchThreads()
      }
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

  // Pre-process markdown: replace [Source: chunk-id] with [1](#cite-chunk-id)
  const formatMarkdownWithCitations = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) return content
    const idToNum = new Map(citations.map((c, i) => [c.chunk_id, i + 1]))

    return content.replace(/\[Source:\s*([^\]]+)\]/g, (_, ids) => {
      const parts = ids
        .split(',')
        .map((id: string) => {
          const cleanId = id.trim()
          const num = idToNum.get(cleanId)
          return num ? `[${num}](#cite-${cleanId})` : ''
        })
        .filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : ''
    })
  }

  // Filter threads by search term
  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchThread.toLowerCase().trim())
  )

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <AppShell currentTab="assistant">
      {/* Main Workspace with Thread Sidebar & Chat Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full flex gap-4 min-h-0 min-w-0">
        {/* Left Sidebar: Conversation Threads (Drawer on mobile, inline panel on md+) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:static md:inset-auto md:z-auto">
            <div
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="relative z-10 w-72 max-w-[85vw] h-full md:h-auto shrink-0 bg-white md:rounded-xl border-r md:border border-slate-200 shadow-lg md:shadow-2xs flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Thread Search Box */}
            <div className="px-3 pt-3 pb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchThread}
                  onChange={(e) => setSearchThread(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-colors"
                />
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y-0 text-xs">
              {isLoadingThreads && threads.length === 0 ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-[11px]">Loading chats...</span>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="py-8 px-3 text-center text-slate-400">
                  <MessageSquare className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">No chat history</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchThread ? 'No matching chats' : 'Start a new conversation to save history'}
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isActive = thread.id === activeThreadId
                  const isEditing = editingThreadId === thread.id

                  if (isEditing) {
                    return (
                      <form
                        key={thread.id}
                        onSubmit={(e) => handleSaveRename(thread.id, e)}
                        className="p-1.5 bg-indigo-50/50 rounded-lg border border-indigo-200 flex items-center gap-1"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
                        />
                        <button
                          type="submit"
                          className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingThreadId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )
                  }

                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectThread(thread.id)}
                      className={`group w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-indigo-50/80 text-indigo-900 font-semibold border border-indigo-200/70 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span className="truncate text-xs">{thread.title}</span>
                      </div>

                      {/* Thread Hover Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingThreadId(thread.id)
                            setEditingTitle(thread.title)
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-white transition-colors"
                          title="Rename chat"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
          </div>
        )}

        {/* Right Main Chat Panel */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {/* Top Header Bar */}
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer mr-1 shadow-2xs"
                  title="Open Chat History"
                >
                  <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                </button>
              )}
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
                    {activeThread ? activeThread.title : 'Knowledge Assistant'}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                    Grounded in Company Knowledge
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeThread
                    ? `Saved session • ${messages.length} messages`
                    : 'Multi-tenant AI semantic search synthesized from company documents.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Multi-Agent vs Standard RAG Mode Toggle */}
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setChatMode('agent')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                    chatMode === 'agent'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Multi-Agent Supervisor: intent routing to knowledge search or office workflows"
                >
                  <Workflow className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Multi-Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode('rag')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                    chatMode === 'rag'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Standard RAG: direct vector retrieval from company documents"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Standard RAG</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Conversation</span>
              </button>
            </div>
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
                  <Sparkles className="w-7 h-7" />
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
                        className="p-3 text-xs text-left bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-xl text-slate-700 hover:text-indigo-900 transition-all font-medium flex items-start gap-2 shadow-2xs group cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
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
                  <div className="max-w-2xl bg-indigo-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-sm shadow-xs font-medium leading-relaxed">
                    {message.content}
                  </div>
                ) : (
                  // Assistant Answer Card
                  <div className="max-w-3xl w-full bg-slate-50/80 border border-slate-200 rounded-2xl rounded-tl-xs p-5 space-y-4 shadow-2xs">
                    {/* Top Meta Bar */}
                    <div className="flex flex-wrap items-center justify-between text-xs pb-3 border-b border-slate-200/80 gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                          <Sparkles className="w-3 h-3" />
                        </div>
                        <span className="font-semibold text-slate-800">WorkMesh Assistant</span>

                        {/* Agent Routing Badges */}
                        {message.agentHandled === 'knowledge_agent' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                            <BookOpen className="w-3 h-3 text-indigo-600" />
                            Routed via Knowledge Agent
                          </span>
                        )}
                        {message.agentHandled === 'office_agent' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                            <FileEdit className="w-3 h-3 text-amber-600" />
                            Drafted via Office Agent
                          </span>
                        )}
                        {message.agentHandled === 'supervisor' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                            <Bot className="w-3 h-3 text-purple-600" />
                            Handled by Supervisor
                          </span>
                        )}

                        {message.grounded && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Grounded in Company Knowledge
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {message.agentPath && message.agentPath.length > 1 && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                            title={`Agent Trajectory: ${message.agentPath.join(' → ')}`}
                          >
                            <Workflow className="w-2.5 h-2.5 text-slate-400" />
                            {message.agentPath.join(' → ')}
                          </span>
                        )}
                        {message.model && (
                          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                            {message.model}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Markdown Formatted Answer Body */}
                    <div className="prose prose-xs sm:prose-sm max-w-none text-slate-800 leading-relaxed font-normal">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => {
                            if (href?.startsWith('#cite-')) {
                              const chunkId = href.replace('#cite-', '')
                              const citation = message.citations?.find((c) => c.chunk_id === chunkId)
                              return (
                                <button
                                  type="button"
                                  onClick={() => citation && setSelectedCitation(citation)}
                                  className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 mx-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer align-baseline"
                                  title={citation ? `Source from document ${citation.document_id}` : 'Source citation'}
                                >
                                  {children}
                                </button>
                              )
                            }
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-indigo-600 hover:text-indigo-800 underline font-medium"
                              >
                                {children}
                              </a>
                            )
                          },
                          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="pl-0.5">{children}</li>,
                          code: ({ children }) => (
                            <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-800 font-mono text-[11px]">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {formatMarkdownWithCitations(message.content, message.citations)}
                      </ReactMarkdown>
                    </div>

                    {/* Citations Footer Drawer Links */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="pt-3 border-t border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Grounded Sources ({message.citations.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {message.citations.map((cite) => (
                            <button
                              key={cite.chunk_id}
                              type="button"
                              onClick={() => setSelectedCitation(cite)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-slate-700 hover:text-indigo-900 transition-colors shadow-2xs font-medium cursor-pointer"
                            >
                              <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                #{cite.chunk_index + 1}
                              </span>
                              <span className="max-w-[140px] truncate">{`Chunk #${cite.chunk_index + 1}`}</span>
                              <span className="text-[10px] text-slate-400">
                                {Math.round(cite.similarity_score * 100)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Email Draft Approval Panel */}
                    {message.draft_payload && (
                      <EmailDraftPanel
                        draft={message.draft_payload}
                        accessToken={accessToken ?? ''}
                      />
                    )}

                    {/* Action Bar (Copy & Helpful Feedback) */}
                    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(message.id, message.content)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Copy answer to clipboard"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] mr-1">Was this helpful?</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFeedback((prev) => ({
                              ...prev,
                              [message.id]: prev[message.id] === 'up' ? undefined! : 'up',
                            }))
                          }
                          className={`p-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer ${
                            feedback[message.id] === 'up'
                              ? 'text-emerald-600 bg-emerald-50'
                              : 'hover:text-slate-700'
                          }`}
                          title="Helpful answer"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFeedback((prev) => ({
                              ...prev,
                              [message.id]: prev[message.id] === 'down' ? undefined! : 'down',
                            }))
                          }
                          className={`p-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer ${
                            feedback[message.id] === 'down'
                              ? 'text-rose-600 bg-rose-50'
                              : 'hover:text-slate-700'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* In-Flight Thinking Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="max-w-md bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-4 flex items-center gap-3 shadow-2xs">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800">
                      Searching company documents & synthesizing answer...
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 shadow-2xs">
                <Info className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-500 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Query Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="mt-4 bg-white rounded-xl border border-slate-200 p-2 shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question about your company's documents, policies, or technical guides..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors shadow-2xs cursor-pointer shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 pt-1.5 pb-0.5 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CornerDownRight className="w-3 h-3 text-slate-300" />
                Press Enter to send query
              </span>
              <span>All queries verified against company documents</span>
            </div>
          </form>
        </main>
      </div>

      {/* Slide-over Source Drawer */}
      <SourceDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
    </AppShell>
  )
}
