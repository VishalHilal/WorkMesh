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
    renderPage()

    expect(screen.getByRole('heading', { name: 'Knowledge Assistant' })).toBeInTheDocument()
    expect(screen.getByText('Ask anything about company knowledge')).toBeInTheDocument()
    expect(screen.getByText(/What is our sick leave and annual vacation policy/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask a question about your company's documents/i)).toBeInTheDocument()
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
      },
      meta: { timestamp: new Date().toISOString() },
    }

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockRagResponse,
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
    expect(screen.getByText('Grounded in Company Knowledge')).toBeInTheDocument()
    expect(screen.getByText(/Chunk #1/i)).toBeInTheDocument()
    expect(screen.getByText('94%')).toBeInTheDocument()

    // Verify fetch call was sent to /api/v1/rag/chat with token
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/rag/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_jwt_access_token_123',
        },
        body: JSON.stringify({
          query: 'What is our sick leave policy?',
          top_k: 5,
          threshold: 0.4,
          chat_history: [],
        }),
      }),
    )
  })

  it('clicking a starter prompt triggers query execution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
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
      }),
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
      vi.fn().mockResolvedValueOnce({
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
      }),
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
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: { message: 'AI knowledge service is currently unavailable.' },
        }),
      }),
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
      vi.fn().mockResolvedValueOnce({
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
      }),
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
})
