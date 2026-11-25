import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmailDraftPanel } from './EmailDraftPanel'
import { KnowledgeAssistantPage } from './KnowledgeAssistantPage'
import { AuthContext, type AuthContextType } from '../../context/AuthContext'
import * as api from '../../services/api'
import type { EmailDraftPayload } from './types'

const sampleDraft: EmailDraftPayload = {
  approval_token: '550e8400-e29b-41d4-a716-446655440000',
  to: 'hr@workmesh.com',
  subject: 'Sick Leave Request',
  body: 'Hi HR, I need to take sick leave tomorrow due to fever.',
  cc: ['manager@workmesh.com'],
}

const mockAuthValue: AuthContextType = {
  user: {
    id: 'user_1',
    email: 'employee@workmesh.test',
    firstName: 'Aarav',
    lastName: 'Sharma',
    companyId: 'company_alpha_1',
    role: 'EMPLOYEE',
  },
  accessToken: 'mock_jwt_token_123',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
}

describe('EmailDraftPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders draft fields correctly', () => {
    render(<EmailDraftPanel draft={sampleDraft} accessToken="mock_jwt_token_123" />)

    expect(screen.getByText('hr@workmesh.com')).toBeInTheDocument()
    expect(screen.getByText('manager@workmesh.com')).toBeInTheDocument()
    expect(screen.getByText('Sick Leave Request')).toBeInTheDocument()
    expect(
      screen.getByText('Hi HR, I need to take sick leave tomorrow due to fever.')
    ).toBeInTheDocument()
  })

  it('approve button calls approveDraft and shows confirmation badge & toast', async () => {
    const spy = vi.spyOn(api, 'approveDraft').mockResolvedValue({
      success: true,
      message: 'Email approved and queued for send',
    })

    render(<EmailDraftPanel draft={sampleDraft} accessToken="mock_jwt_token_123" />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(sampleDraft.approval_token, 'mock_jwt_token_123')
      expect(screen.getByText(/Email approved and queued/i)).toBeInTheDocument()
      expect(screen.getByText(/Sent Confirmation Queued/i)).toBeInTheDocument()
    })
  })

  it('reject button calls rejectDraft and collapses review panel', async () => {
    const spy = vi.spyOn(api, 'rejectDraft').mockResolvedValue({ success: true })

    render(<EmailDraftPanel draft={sampleDraft} accessToken="mock_jwt_token_123" />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(sampleDraft.approval_token, 'mock_jwt_token_123')
      expect(screen.queryByTestId('email-draft-panel')).not.toBeInTheDocument()
      expect(screen.getByText(/Draft discarded/i)).toBeInTheDocument()
    })
  })

  it('disables both buttons while approve API call is in-flight', async () => {
    let resolveApprove: (val: { success: boolean; message: string }) => void
    const pendingPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
      resolveApprove = resolve
    })
    vi.spyOn(api, 'approveDraft').mockReturnValue(pendingPromise)

    render(<EmailDraftPanel draft={sampleDraft} accessToken="mock_jwt_token_123" />)

    const approveBtn = screen.getByRole('button', { name: /approve/i })
    const rejectBtn = screen.getByRole('button', { name: /reject/i })
    fireEvent.click(approveBtn)

    expect(approveBtn).toBeDisabled()
    expect(rejectBtn).toBeDisabled()

    resolveApprove!({ success: true, message: 'Email approved and queued for send' })
    await waitFor(() => {
      expect(screen.getByText(/Email approved and queued/i)).toBeInTheDocument()
    })
  })

  it('shows error banner on approve API failure', async () => {
    vi.spyOn(api, 'approveDraft').mockRejectedValue(new Error('Draft already processed'))

    render(<EmailDraftPanel draft={sampleDraft} accessToken="mock_jwt_token_123" />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Draft already processed')
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  it('KnowledgeAssistantPage renders EmailDraftPanel when draft_payload is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/threads')) {
          return { ok: true, json: async () => ({ success: true, data: [] }) }
        }
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'Email HR about sick leave',
                answer: 'I have prepared an email draft for your review.',
                citations: [],
                model: 'gemini-2.5-flash',
                grounded: false,
                agentHandled: 'office_agent',
                agentPath: ['supervisor', 'office_agent'],
                iterations: 1,
                mode: 'agent',
                draft_payload: sampleDraft,
              },
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <MemoryRouter>
          <KnowledgeAssistantPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'Email HR about sick leave' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByTestId('email-draft-panel')).toBeInTheDocument()
      expect(screen.getByText('Sick Leave Request')).toBeInTheDocument()
    })
  })

  it('KnowledgeAssistantPage does not render EmailDraftPanel when draft_payload is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/rag/threads')) {
          return { ok: true, json: async () => ({ success: true, data: [] }) }
        }
        if (url.includes('/api/v1/rag/chat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                query: 'What is our leave policy?',
                answer: 'Employees receive 12 days of sick leave annually.',
                citations: [],
                model: 'gemini-2.5-flash',
                grounded: true,
                agentHandled: 'knowledge_agent',
                agentPath: ['supervisor', 'knowledge_agent'],
                iterations: 1,
                mode: 'agent',
              },
            }),
          }
        }
        return { ok: true, json: async () => ({}) }
      })
    )

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <MemoryRouter>
          <KnowledgeAssistantPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const input = screen.getByPlaceholderText(/Ask a question about your company's documents/i)
    fireEvent.change(input, { target: { value: 'What is our leave policy?' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Employees receive 12 days of sick leave annually/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('email-draft-panel')).not.toBeInTheDocument()
  })
})
