import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

describe('Authentication & Protected Routes', () => {
  beforeEach(() => {
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
              email: 'alex@nexora.test',
              firstName: 'Alex',
              lastName: 'Chen',
              companyId: 'c1',
              role: 'EMPLOYEE',
            },
          },
        }),
      }),
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'alex@nexora.test' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Your company workspace, connected.' }),
      ).toBeInTheDocument()
      expect(screen.getByText(/Welcome back, Alex/)).toBeInTheDocument()
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
})
