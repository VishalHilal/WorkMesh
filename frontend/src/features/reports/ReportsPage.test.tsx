import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ReportsPage } from './ReportsPage'
import { AuthContext, type AuthContextType } from '../../context/AuthContext'

const mockAuthValue: AuthContextType = {
  user: {
    id: 'user_1',
    email: 'employee@workmesh.test',
    firstName: 'Aarav',
    lastName: 'Sharma',
    companyId: 'company_alpha_1',
    role: 'EMPLOYEE',
  },
  accessToken: 'mock_jwt_token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
}

const existingReport = {
  id: 'rep_1',
  companyId: 'company_alpha_1',
  userId: 'user_1',
  title: 'Q4 Security Audit',
  format: 'PDF' as const,
  template: 'compliance_audit',
  fileName: 'q4-security-audit.pdf',
  mimeType: 'application/pdf',
  fileSize: 4096,
  createdAt: '2026-11-25T12:00:00.000Z',
}

function renderReportsPage() {
  return render(
    <AuthContext.Provider value={mockAuthValue}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders report builder form and existing reports list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [existingReport] }),
      })
    )

    renderReportsPage()

    expect(screen.getByRole('heading', { name: 'Report Generation' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Report Title/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Q4 Security Audit')).toBeInTheDocument()
    })
  })

  it('generates a new report and prepends it to the list', async () => {
    const newReport = {
      ...existingReport,
      id: 'rep_2',
      title: 'HR Leave Brief',
      format: 'DOCX' as const,
      fileName: 'hr-leave-brief.docx',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/reports/generate') && init?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: newReport }) }
        }
        return { ok: true, json: async () => ({ success: true, data: [existingReport] }) }
      })
    )

    renderReportsPage()
    await waitFor(() => expect(screen.getByText('Q4 Security Audit')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/Report Title/i), {
      target: { value: 'HR Leave Brief' },
    })
    fireEvent.change(screen.getByLabelText(/Topic & Synthesis Instructions/i), {
      target: { value: 'Summarize sick leave rules' },
    })
    fireEvent.change(screen.getByLabelText(/Output Format/i), {
      target: { value: 'docx' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }))

    await waitFor(() => {
      expect(screen.getByText('HR Leave Brief')).toBeInTheDocument()
      expect(screen.getByText(/generated successfully/i)).toBeInTheDocument()
    })
  })

  it('opens presigned download URL when clicking Download', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/download')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { downloadUrl: 'https://s3.example/q4.pdf', fileName: 'q4.pdf' },
            }),
          }
        }
        return { ok: true, json: async () => ({ success: true, data: [existingReport] }) }
      })
    )

    renderReportsPage()
    await waitFor(() => expect(screen.getByText('Q4 Security Audit')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Download/i }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://s3.example/q4.pdf',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('removes report from list when clicking Delete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/reports/rep_1') && init?.method === 'DELETE') {
          return { ok: true, json: async () => ({ success: true }) }
        }
        return { ok: true, json: async () => ({ success: true, data: [existingReport] }) }
      })
    )

    renderReportsPage()
    await waitFor(() => expect(screen.getByText('Q4 Security Audit')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Delete Q4 Security Audit/i }))

    await waitFor(() => {
      expect(screen.queryByText('Q4 Security Audit')).not.toBeInTheDocument()
    })
  })

  it('displays error banner when report generation API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/v1/reports/generate') && init?.method === 'POST') {
          return {
            ok: false,
            json: async () => ({ error: { message: 'AI synthesis unavailable' } }),
          }
        }
        return { ok: true, json: async () => ({ success: true, data: [] }) }
      })
    )

    renderReportsPage()
    await waitFor(() => expect(screen.getByText(/No reports generated yet/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/Report Title/i), { target: { value: 'Fail Report' } })
    fireEvent.change(screen.getByLabelText(/Topic & Synthesis Instructions/i), {
      target: { value: 'Test failure' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('AI synthesis unavailable')
    })
  })
})
