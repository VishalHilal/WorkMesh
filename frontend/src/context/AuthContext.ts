import { createContext, useContext } from 'react'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  companyId: string
  role: string
}

export interface AuthContextType {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
