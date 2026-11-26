import { useState, useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Home,
  FileText,
  FileBarChart2,
  Sparkles,
  Users,
  ShieldCheck,
  Search,
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context'

export type NavTab = 'workspace' | 'documents' | 'assistant' | 'reports' | 'directory' | 'audit'

interface AppShellProps {
  currentTab: NavTab
  children: ReactNode
}

interface QuickAction {
  label: string
  description: string
  to: string
  adminOnly?: boolean
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Workspace Dashboard', description: 'Overview, status & recent activity', to: '/' },
  { label: 'Ask AI Assistant', description: 'Query company docs & draft emails', to: '/assistant' },
  { label: 'Documents & Upload', description: 'Upload PDF, DOCX, or TXT knowledge files', to: '/documents' },
  { label: 'Generate Report', description: 'Create executive PDF or DOCX reports', to: '/reports' },
  { label: 'Manage Employees', description: 'View directory & assign roles', to: '/admin/users', adminOnly: true },
  { label: 'Audit Logs', description: 'Inspect company security events', to: '/admin/audit-logs', adminOnly: true },
]

export function AppShell({ currentTab, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
        setHelpOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  const navItems: Array<{ id: NavTab; label: string; to: string; icon: typeof Home }> = [
    { id: 'workspace', label: 'Workspace', to: '/', icon: Home },
    { id: 'documents', label: 'Documents', to: '/documents', icon: FileText },
    { id: 'reports', label: 'Reports', to: '/reports', icon: FileBarChart2 },
    { id: 'assistant', label: 'AI Assistant', to: '/assistant', icon: Sparkles },
  ]

  const filteredActions = QUICK_ACTIONS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (item.label.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase().trim()))
  )

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-indigo-100/90">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
        <Link
          to="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
            W
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">WorkMesh</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentTab === item.id
          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {isAdmin && (
          <div className="pt-5 mt-5 border-t border-slate-100 space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <Link
              to="/admin/users"
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                currentTab === 'directory'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <Users
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'directory' ? 'text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span>Manage Employees</span>
            </Link>
            <Link
              to="/admin/audit-logs"
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                currentTab === 'audit'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <ShieldCheck
                className={`w-4 h-4 shrink-0 ${
                  currentTab === 'audit' ? 'text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span>Audit Logs</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer Utility */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Help &amp; Support</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900 flex font-sans">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-full h-full z-10 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-indigo-100/80 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-full bg-[#f6f7fb] hover:bg-indigo-50/60 border border-slate-200/80 text-sm text-slate-500 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Search anything...</span>
              </span>
              <kbd className="hidden sm:inline-block text-[11px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/assistant')}
              aria-label="Notifications"
              title="Notifications"
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div
                className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs shadow-2xs"
                title={`${user?.firstName} ${user?.lastName}`}
              >
                {userInitials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-900 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-500 leading-tight">{formatRole(user?.role)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 flex flex-col">{children}</div>
      </div>

      {/* Global Command Search Modal (⌘/Ctrl + K) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/35 backdrop-blur-xs"
          onClick={() => setSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Quick navigation search"
            className="w-full max-w-lg bg-white rounded-2xl border border-indigo-100 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
              <Search className="w-4 h-4 text-indigo-600 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to workspace, documents, AI assistant, or reports..."
                className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ESC
              </button>
            </div>
            <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredActions.map((action) => (
                <li key={action.to}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(action.to)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-50/60 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                      <p className="text-xs text-slate-500">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                </li>
              ))}
              {filteredActions.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-slate-500">
                  No matching destinations found.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/35 backdrop-blur-xs"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Help and Support"
            className="w-full max-w-md bg-white rounded-2xl border border-indigo-100 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">WorkMesh Quick Guide</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-900">⌘K / Ctrl+K:</strong> Open quick search anywhere.
              </li>
              <li>
                <strong className="text-slate-900">AI Assistant:</strong> Toggle Multi-Agent mode to route between policy Q&amp;A and email drafting.
              </li>
              <li>
                <strong className="text-slate-900">Reports:</strong> Generate grounded PDF &amp; DOCX summaries from your company documents.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
