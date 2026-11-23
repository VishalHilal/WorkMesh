import { useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const login = async (email: string, password: string): Promise<void> => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const body = await res.json()

    if (!res.ok) {
      const errorMessage =
        body?.error?.message ?? 'Authentication failed. Please verify your credentials.'
      throw new Error(errorMessage)
    }

    setAccessToken(body.data.accessToken)
    setUser(body.data.user)
  }

  const logout = (): void => {
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
