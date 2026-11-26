import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { KnowledgeAssistantPage } from './KnowledgeAssistantPage'
import { AuthContext, type AuthContextType } from '../../context/AuthContext'

const mockUser = {
  id: 'user_1',
  email: 'employee@workmesh.test',
  firstName: 'Aarav',
  lastName: 'Sharma',
  companyId: 'company_alpha_1',
  role: 'EMPLOYEE' as const,
}

const mockAuthValue: AuthContextType = {
  user: mockUser,
  accessToken: 'mock_jwt_access_token_123',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
}

const mockThreads = [
  {
    id: 'thread_1',
    companyId: 'company_alpha_1',
    userId: 'user_1',
    title: 'HR Leave Policy Inquiries',
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:30:00.000Z',
    _count: { messages: 2 },
  },
  {
    id: 'thread_2',
    companyId: 'company_alpha_1',
    userId: 'user_1',
    title: 'Security Guidelines Q&A',
    createdAt: '2026-11-25T09:00:00.000Z',
    updatedAt: '2026-11-25T09:15:00.000Z',
    _count: { messages: 4 },
  },
]

function renderPage(authOverrides?: Partial<AuthContextType>) {
  return render(
    <AuthContext.Provider value={{ ...mockAuthValue, ...authOverrides }}>
      <MemoryRouter>
        <KnowledgeAssistantPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('KnowledgeAssistantPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders welcome screen with header and starter prompts', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/threads')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: [] }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    renderPage()

    expect(screen.getByRole('heading', { name: 'Knowledge Assistant' })).toBeInTheDocument()
    expect(screen.getByText('Ask anything about company knowledge')).toBeInTheDocument()
    expect(screen.getByText(/What is our sick leave and annual vacation policy/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask a question about your company's documents/i)).toBeInTheDocument()
  })

  it('renders conversation threads in the sidebar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/threads')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockThreads }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('HR Leave Policy Inquiries')).toBeInTheDocument()
      expect(screen.getByText('Security Guidelines Q&A')).toBeInTheDocument()
    })
  })

  it('switches thread and loads previous messages on sidebar click', async () => {
    const thread1Detail = {
      id: 'thread_1',
      title: 'HR Leave Policy Inquiries',
      companyId: 'company_alpha_1',
      userId: 'user_1',
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:30:00.000Z',
      messages: [
        {
          id: 'msg_1',
          threadId: 'thread_1',
          role: 'user',
          content: 'How many days of sick leave do we get?',
          citations: null,
          createdAt: '2026-11-25T10:00:00.000Z',
        },
        {
          id: 'msg_2',
          threadId: 'thread_1',
          role: 'assistant',
          content: 'You receive 10 paid sick days per year.',
          citations: [],
          createdAt: '2026-11-25T10:00:05.000Z',
        },
      ],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/rag/threads') {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockThreads }),
          }
        }
        if (url === '/api/v1/rag/threads/thread_1') {
          return {
            ok: true,
            json: async () => ({ success: true, data: thread1Detail }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('HR Leave Policy Inquiries')).toBeInTheDocument()
    })

    // Click thread item in sidebar
    fireEvent.click(screen.getByText('HR Leave Policy Inquiries'))

    await waitFor(() => {
      expect(screen.getByText('How many days of sick leave do we get?')).toBeInTheDocument()
      expect(screen.getByText('You receive 10 paid sick days per year.')).toBeInTheDocument()
    })
  })

  it('submits a query, displays loading state, and renders assistant response with citations', async () => {
    const mockRagResponse = {
      success: true,
      data: {
        query: 'What is our sick leave policy?',
        answer: 'Employees receive 10 days of paid sick leave annually [Source: chunk-1].',
        citations: [
          {
            chunk_id: 'chunk-1',
            document_id: 'doc-handbook',
            chunk_index: 0,
            snippet: 'Employees are entitled to 10 paid sick days per calendar year.',
            similarity_score: 0.94,
          },
        ],
        model: 'gemini-3.8-flash',
        grounded: true,
        thread_id: 'thread_auto_created_1',
      },
      meta: { timestamp: new Date().toISOString() },
    }

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/rag/chat')) {
        return {
          ok: true,
          json: async () => mockRagResponse,
        }
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }
    })
    vi.stubGlobal('fetch', mockFetch)

    renderPage()

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    const sendButton = screen.getByRole('button', { name: 'Send message' })

    fireEvent.change(input, { target: { value: 'What is our sick leave policy?' } })
    fireEvent.click(sendButton)

    // User message should appear immediately
    expect(screen.getByText('What is our sick leave policy?')).toBeInTheDocument()

    // Wait for assistant response to render
    await waitFor(() => {
      expect(
        screen.getByText(/Employees receive 10 days of paid sick leave annually/i),
      ).toBeInTheDocument()
    })

    // Grounded model badge and citation button
    expect(screen.getByText('gemini-3.8-flash')).toBeInTheDocument()
    expect(screen.getAllByText('Grounded in Company Knowledge').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Chunk #1/i)).toBeInTheDocument()
    expect(screen.getByText('94%')).toBeInTheDocument()
  })

  it('clicking a starter prompt triggers query execution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'What is our sick leave and annual vacation policy?',
                answer: 'Vacation policy grants 20 days paid leave.',
                citations: [],
                model: 'gemini-3.8-flash',
                grounded: true,
              },
              meta: { timestamp: new Date().toISOString() },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        }
      })
    )

    renderPage()

    const promptBtn = screen.getByText('What is our sick leave and annual vacation policy?')
    fireEvent.click(promptBtn)

    await waitFor(() => {
      expect(screen.getByText('Vacation policy grants 20 days paid leave.')).toBeInTheDocument()
    })
  })

  it('opens and closes the source citation drawer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'Explain security rules',
                answer: 'All devices must use full-disk encryption.',
                citations: [
                  {
                    chunk_id: 'sec-chunk-99',
                    document_id: 'sec-doc-1',
                    chunk_index: 2,
                    snippet: 'Mandatory full-disk encryption with BitLocker or FileVault.',
                    similarity_score: 0.88,
                  },
                ],
                model: 'gemini-3.8-flash',
                grounded: true,
              },
              meta: { timestamp: new Date().toISOString() },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        }
      })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'Explain security rules' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('All devices must use full-disk encryption.')).toBeInTheDocument()
    })

    // Click the citation button to open the drawer
    const citationBtn = screen.getByText(/Chunk #3/i)
    fireEvent.click(citationBtn)

    // Drawer should open and display the excerpt snippet
    expect(screen.getByText('Grounded Source Citation')).toBeInTheDocument()
    expect(
      screen.getByText('Mandatory full-disk encryption with BitLocker or FileVault.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('88%').length).toBeGreaterThanOrEqual(1)

    // Close the drawer
    const doneBtn = screen.getByRole('button', { name: 'Done' })
    fireEvent.click(doneBtn)

    await waitFor(() => {
      expect(screen.queryByText('Grounded Source Citation')).not.toBeInTheDocument()
    })
  })

  it('displays error alert banner when API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              error: { message: 'AI knowledge service is currently unavailable.' },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        }
      })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'test question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(
        screen.getByText('AI knowledge service is currently unavailable.'),
      ).toBeInTheDocument()
    })
  })

  it('resets conversation when clicking New Conversation button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'Query 1',
                answer: 'Answer 1',
                citations: [],
                model: 'gemini-3.8-flash',
                grounded: true,
              },
              meta: { timestamp: new Date().toISOString() },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        }
      })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'Query 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('Answer 1')).toBeInTheDocument()
    })

    const resetBtn = screen.getByRole('button', { name: /New Conversation/i })
    fireEvent.click(resetBtn)

    // Conversation is cleared, back to welcome state
    expect(screen.queryByText('Answer 1')).not.toBeInTheDocument()
    expect(screen.getByText('Ask anything about company knowledge')).toBeInTheDocument()
  })

  it('deletes a conversation thread via delete button in sidebar', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url === '/api/v1/rag/threads') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [...mockThreads] }),
        }
      }
      if (url === '/api/v1/rag/threads/thread_1' && opts?.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        }
      }
      return { ok: true, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('HR Leave Policy Inquiries')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByTitle('Delete chat')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/rag/threads/thread_1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('toggles between Multi-Agent and Standard RAG mode and submits selected mode', async () => {
    let capturedBody: Record<string, unknown> | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
        if (url === '/api/v1/rag/threads') {
          return {
            ok: true,
            json: async () => ({ success: true, data: [] }),
          }
        }
        if (url === '/api/v1/rag/chat') {
          capturedBody = JSON.parse(opts?.body as string)
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'Test question',
                answer: 'RAG Answer',
                citations: [],
                model: 'gemini-3.8-flash',
                grounded: true,
                mode: capturedBody?.mode,
                agentHandled: 'knowledge_agent',
              },
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    renderPage()

    // 1. By default, Multi-Agent mode is active
    const multiAgentBtn = screen.getByRole('button', { name: /Multi-Agent/i })
    const standardRagBtn = screen.getByRole('button', { name: /Standard RAG/i })
    expect(multiAgentBtn).toBeInTheDocument()
    expect(standardRagBtn).toBeInTheDocument()

    // 2. Click Standard RAG toggle
    fireEvent.click(standardRagBtn)

    // 3. Send message
    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'Test question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
      expect(capturedBody?.mode).toBe('rag')
    })
  })

  it('displays Agent Routing Badges and trajectory pill when returned by backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/rag/threads') {
          return {
            ok: true,
            json: async () => ({ success: true, data: [] }),
          }
        }
        if (url === '/api/v1/rag/chat') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'Draft announcement',
                answer: '### Executive Memo\n\nPlease find attached the agenda.',
                citations: [],
                model: 'gemini-3.8-flash',
                grounded: false,
                agentHandled: 'office_agent',
                agentPath: ['supervisor', 'office_agent'],
                iterations: 1,
                mode: 'agent',
              },
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    renderPage()

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'Draft announcement' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByText('Drafted via Office Agent')).toBeInTheDocument()
      expect(screen.getByText('supervisor → office_agent')).toBeInTheDocument()
    })
  })
})
