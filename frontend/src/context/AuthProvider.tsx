import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './AuthContext'

const AUTH_STORAGE_KEY = 'workmesh_auth'

interface StoredAuth {
  user: AuthUser
  accessToken: string
}

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredAuth>
    if (
      typeof parsed?.accessToken === 'string' &&
      parsed.accessToken.length > 0 &&
      parsed.user &&
      typeof parsed.user.id === 'string'
    ) {
      return { accessToken: parsed.accessToken, user: parsed.user }
    }
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<{ user: AuthUser | null; accessToken: string | null }>(
    () => readStoredAuth() ?? { user: null, accessToken: null }
  )

  useEffect(() => {
    const restored = readStoredAuth()
    if (!restored) return

    let cancelled = false
    const req = fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${restored.accessToken}` },
    })
    if (!req || typeof req.then !== 'function') return

    req
      .then((res) => {
        if (!cancelled && res.status === 401) {
          try {
            window.localStorage.removeItem(AUTH_STORAGE_KEY)
          } catch {
            // Ignore storage errors
          }
          setAuth({ user: null, accessToken: null })
        }
      })
      .catch(() => {
        // Ignore transient network errors so offline/temporary hiccups don't force logout
      })

    return () => {
      cancelled = true
    }
  }, [])

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

    const nextAuth: StoredAuth = {
      accessToken: body.data.accessToken,
      user: body.data.user,
    }
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth))
    } catch {
      // Ignore storage quota / private-mode errors
    }
    setAuth(nextAuth)
  }

  const logout = (): void => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
    setAuth({ accessToken: null, user: null })
  }

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        accessToken: auth.accessToken,
        isAuthenticated: !!auth.accessToken && !!auth.user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
