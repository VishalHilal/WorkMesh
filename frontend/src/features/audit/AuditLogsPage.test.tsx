import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuditLogsPage } from './AuditLogsPage'
import { AuthContext, type AuthContextType } from '../../context/AuthContext'
import type { AuditLogItem } from './types'

const mockUser = {
  id: 'user_admin',
  email: 'admin@workmesh.test',
  firstName: 'Aarav',
  lastName: 'Sharma',
  companyId: 'company_1',
  role: 'ADMIN' as const,
}

const mockAuthValue: AuthContextType = {
  user: mockUser,
  accessToken: 'mock_jwt_token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
}

const mockAuditLogs: AuditLogItem[] = [
  {
    id: 'log_1',
    companyId: 'company_1',
    userId: 'user_admin',
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: 'user_admin',
    details: { email: 'admin@workmesh.test', role: 'ADMIN' },
    ipAddress: '127.0.0.1',
    createdAt: '2026-11-25T10:00:00.000Z',
    user: {
      id: 'user_admin',
      firstName: 'Aarav',
      lastName: 'Sharma',
      email: 'admin@workmesh.test',
    },
  },
  {
    id: 'log_2',
    companyId: 'company_1',
    userId: 'user_admin',
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: 'user_emp_2',
    details: { previousRole: 'EMPLOYEE', newRole: 'MANAGER' },
    ipAddress: '127.0.0.1',
    createdAt: '2026-11-25T10:30:00.000Z',
    user: {
      id: 'user_admin',
      firstName: 'Aarav',
      lastName: 'Sharma',
      email: 'admin@workmesh.test',
    },
  },
]

describe('AuditLogsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const renderComponent = () =>
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <MemoryRouter>
          <AuditLogsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

  it('renders header, description, and audit logs table on load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockAuditLogs,
          meta: {
            total: 2,
            page: 1,
            limit: 15,
            totalPages: 1,
            timestamp: new Date().toISOString(),
          },
        }),
      })
    )

    renderComponent()

    expect(screen.getByText('Security Audit Trail')).toBeInTheDocument()
    expect(
      screen.getByText(/Immutable, append-only record of authentication/i)
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Login Success')).toBeInTheDocument()
      expect(screen.getByText('Role Modified')).toBeInTheDocument()
      expect(screen.getAllByText('Aarav Sharma').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('filters by action when clicking an action filter button', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('action=AUTH_LOGIN_SUCCESS')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [mockAuditLogs[0]],
            meta: { total: 1, page: 1, limit: 15, totalPages: 1 },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: mockAuditLogs,
          meta: { total: 2, page: 1, limit: 15, totalPages: 1 },
        }),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Login Success')).toBeInTheDocument()
    })

    // Click 'Logins' filter tab
    const loginsTab = screen.getByRole('button', { name: 'Logins' })
    fireEvent.click(loginsTab)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('action=AUTH_LOGIN_SUCCESS'),
        expect.any(Object)
      )
    })
  })

  it('opens and closes the JSON metadata payload inspector modal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockAuditLogs,
          meta: { total: 2, page: 1, limit: 15, totalPages: 1 },
        }),
      })
    )

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('View Payload')[0]).toBeInTheDocument()
    })

    // Click "View Payload" on the first row
    const payloadButtons = screen.getAllByText('View Payload')
    fireEvent.click(payloadButtons[0])

    expect(screen.getByText('Audit Payload Inspector')).toBeInTheDocument()
    expect(screen.getByText('AUTH_LOGIN_SUCCESS')).toBeInTheDocument()

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText('Audit Payload Inspector')).not.toBeInTheDocument()
    })
  })

  it('renders error state when audit log fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Unauthorized access to security audit log.' },
        }),
      })
    )

    renderComponent()

    await waitFor(() => {
      expect(
        screen.getByText('Unauthorized access to security audit log.')
      ).toBeInTheDocument()
    })
  })
})
