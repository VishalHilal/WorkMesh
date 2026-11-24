import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { LoginPage } from './features/auth/LoginPage'
import { UserManagementPage } from './features/users/UserManagementPage'
import { DocumentManagementPage } from './features/documents/DocumentManagementPage'
import './App.css'

function DashboardShell() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <main className="application-shell">
      <section aria-labelledby="workmesh-heading">
        <div className="flex items-center justify-between mb-4">
          <p className="eyebrow m-0">WorkMesh AI</p>
          <div className="flex items-center gap-4">
            <Link
              to="/documents"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Documents →
            </Link>
            {isAdmin && (
              <Link
                to="/admin/users"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Manage Employees →
              </Link>
            )}
            <button
              onClick={logout}
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
        <h1 id="workmesh-heading">Your company workspace, connected.</h1>
        <p className="description">
          Welcome back, {user?.firstName ?? 'Employee'} ({user?.role?.replace('_', ' ')}). The
          employee productivity workspace is ready.
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
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <UserManagementPage />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
