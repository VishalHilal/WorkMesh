import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEMO_ACCOUNTS = [
  { role: 'Admin', name: 'Priya Patel', email: 'admin@workmesh.test' },
  { role: 'Manager', name: 'Rohan Verma', email: 'manager.eng@workmesh.test' },
  { role: 'Employee', name: 'Karan Mehta', email: 'employee.dev@workmesh.test' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const validate = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {}

    if (!email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (!password) {
      nextErrors.password = 'Password is required'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid credentials. Please try again.'
      setErrors({ form: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('WorkMesh@2026!')
    setErrors({})
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-xs mb-3">
            WM
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            WorkMesh Technologies Pvt. Ltd. enterprise workspace
          </p>
        </div>

        {errors.form && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700"
          >
            {errors.form}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email address
            </label>
            <div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 sm:text-sm transition-colors ${
                  errors.email ? 'border-red-400 focus:border-red-500' : 'border-slate-300'
                }`}
                placeholder="name@company.com"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600 font-medium">
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-slate-900 shadow-2xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 sm:text-sm transition-colors ${
                  errors.password ? 'border-red-400 focus:border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-600 font-medium">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Demo Credentials Quick-Select Pill Box */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 text-center mb-2.5">
            Quick demo sign-in
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleFillDemo(acc.email)}
                className="p-2 text-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50/60 hover:border-indigo-300 transition-colors cursor-pointer"
                title={`Sign in as ${acc.name} (${acc.role})`}
              >
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  {acc.role}
                </span>
                <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                  {acc.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
