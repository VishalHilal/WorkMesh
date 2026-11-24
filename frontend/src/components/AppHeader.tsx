import { Link } from 'react-router-dom'
import { useAuth } from '../context'

interface AppHeaderProps {
  currentTab: 'workspace' | 'documents' | 'directory'
}

export function AppHeader({ currentTab }: AppHeaderProps) {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const userInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : (user?.firstName?.[0] ?? 'U').toUpperCase()

  const formatRole = (role?: string) => {
    if (!role) return 'Employee'
    return role
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Identity & Main Navigation */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-indigo-700 transition-colors">
                WM
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm tracking-tight leading-none block">
                  WorkMesh AI
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-none block mt-0.5">
                  WorkMesh Technologies Pvt. Ltd.
                </span>
              </div>
            </Link>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  currentTab === 'workspace'
                    ? 'text-indigo-600 bg-indigo-50/70'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Workspace
              </Link>
              <Link
                to="/documents"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  currentTab === 'documents'
                    ? 'text-indigo-600 bg-indigo-50/70'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Documents
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/users"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    currentTab === 'directory'
                      ? 'text-indigo-600 bg-indigo-50/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Manage Employees →
                </Link>
              )}
            </nav>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-2">
              <div
                className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs ring-2 ring-slate-100"
                title={`${user?.firstName} ${user?.lastName}`}
              >
                {userInitials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">
                  {formatRole(user?.role)}
                </p>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <button
              type="button"
              onClick={logout}
              className="text-xs font-medium text-slate-500 hover:text-rose-600 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
