import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

describe('Authentication & Protected Routes', () => {
  beforeEach(() => {
    if (typeof window.localStorage?.clear === 'function') {
      window.localStorage.clear()
    }
    window.history.pushState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated users to the login page', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Sign in to your account' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation errors when fields are empty', () => {
    render(<App />)

    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('shows validation error for invalid email format', () => {
    render(<App />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const submitBtn = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.change(passwordInput, { target: { value: 'somepassword' } })
    fireEvent.click(submitBtn)

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it('displays error message when login fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid email or password.' },
        }),
      }),
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  it('logs in successfully and navigates to protected dashboard shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            accessToken: 'mock.jwt.token',
            user: {
              id: 'u1',
              email: 'karan@workmesh.test',
              firstName: 'Karan',
              lastName: 'Mehta',
              companyId: 'c1',
              role: 'EMPLOYEE',
            },
          },
        }),
      }),
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'karan@workmesh.test' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Your company workspace, connected.' }),
      ).toBeInTheDocument()
      expect(screen.getByText(/Welcome back, Karan/)).toBeInTheDocument()
      // Regular employees do NOT see the Manage Employees admin link
      expect(screen.queryByText(/Manage Employees/)).not.toBeInTheDocument()
    })

    // Test sign out functionality
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    fireEvent.click(signOutBtn)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Sign in to your account' }),
      ).toBeInTheDocument()
    })
  })

  it('allows Admin to view and manage company employees', async () => {
    const mockUsers = [
      {
        id: 'admin_1',
        email: 'admin@workmesh.test',
        firstName: 'Priya',
        lastName: 'Patel',
        isActive: true,
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'emp_1',
        email: 'employee.dev@workmesh.test',
        firstName: 'Karan',
        lastName: 'Mehta',
        isActive: true,
        role: 'EMPLOYEE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              accessToken: 'admin.jwt.token',
              user: {
                id: 'admin_1',
                email: 'admin@workmesh.test',
                firstName: 'Priya',
                lastName: 'Patel',
                companyId: 'c1',
                role: 'ADMIN',
              },
            },
          }),
        })
      }

      if (url.includes('/api/v1/users')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: mockUsers,
            meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
          }),
        })
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    // Log in as Admin
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'admin@workmesh.test' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    // Admin link should be visible
    await waitFor(() => {
      expect(screen.getByText('Manage Employees')).toBeInTheDocument()
    })

    // Click Manage Employees link
    fireEvent.click(screen.getByText('Manage Employees'))

    // Should render Employee Directory table
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Employee Directory & Roles' })).toBeInTheDocument()
      expect(screen.getByText('Karan Mehta')).toBeInTheDocument()
      expect(screen.getByText('employee.dev@workmesh.test')).toBeInTheDocument()
    })
  })
})
