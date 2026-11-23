import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './features/auth/LoginPage'
import './App.css'

function DashboardShell() {
  const { user, logout } = useAuth()

  return (
    <main className="application-shell">
      <section aria-labelledby="workmesh-heading">
        <div className="flex items-center justify-between mb-4">
          <p className="eyebrow m-0">WorkMesh AI</p>
          <button
            onClick={logout}
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
        <h1 id="workmesh-heading">Your company workspace, connected.</h1>
        <p className="description">
          Welcome back, {user?.firstName ?? 'Employee'}. The employee productivity workspace is
          ready.
        </p>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardShell />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
