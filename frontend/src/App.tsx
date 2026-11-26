import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { UserManagementPage } from './features/users/UserManagementPage'
import { DocumentManagementPage } from './features/documents/DocumentManagementPage'
import { KnowledgeAssistantPage } from './features/rag/KnowledgeAssistantPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { AuditLogsPage } from './features/audit/AuditLogsPage'
import {
  FileText,
  Sparkles,
  FileBarChart2,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Upload,
  FolderOpen,
  History,
  ArrowRight,
  Mail,
} from 'lucide-react'
import './App.css'

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function DashboardShell() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const firstName = user?.firstName ?? 'Employee'

  const recentActivity = [
    {
      id: 'act_1',
      label: 'Knowledge Base indexed & ready for semantic search',
      time: 'Just now',
      to: '/documents',
      icon: FileText,
      tone: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'act_2',
      label: 'Generate executive PDF & DOCX reports from company docs',
      time: 'Reports Hub',
      to: '/reports',
      icon: FileBarChart2,
      tone: 'bg-violet-50 text-violet-600',
    },
    {
      id: 'act_3',
      label: 'Draft internal emails with human-in-the-loop approval',
      time: 'Office Agent',
      to: '/assistant',
      icon: Mail,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'act_4',
      label: 'Ask grounded questions with verifiable source citations',
      time: 'AI Assistant',
      to: '/assistant',
      icon: Sparkles,
      tone: 'bg-emerald-50 text-emerald-600',
    },
  ]

  return (
    <AppShell currentTab="workspace">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Hero Greeting Card */}
        <section
          aria-labelledby="workmesh-heading"
          className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-violet-100/60 p-6 sm:p-8 shadow-xs"
        >
          {/* Subtle branded network SVG backdrop */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-30 text-indigo-300 hidden md:block"
            viewBox="0 0 400 220"
            fill="none"
          >
            <circle cx="280" cy="48" r="4" fill="currentColor" />
            <circle cx="350" cy="85" r="5" fill="currentColor" />
            <circle cx="240" cy="120" r="4" fill="currentColor" />
            <circle cx="320" cy="160" r="5" fill="currentColor" />
            <circle cx="375" cy="35" r="3" fill="currentColor" />
            <path
              d="M280 48L350 85M280 48L240 120M350 85L320 160M240 120L320 160M350 85L375 35M280 48L375 35"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>

          <div className="relative z-10 max-w-3xl space-y-5">
            <div>
              <h1
                id="workmesh-heading"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900"
              >
                {getTimeGreeting()}, {firstName} 👋
              </h1>
              <h2 className="sr-only">Your company workspace, connected.</h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
                Welcome back, {firstName}. Find answers, organize company knowledge, and move work forward.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/assistant"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ask AI Assistant</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-indigo-200/80 rounded-xl text-sm font-semibold hover:bg-indigo-50/50 transition-colors shadow-2xs"
              >
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Upload Document</span>
              </Link>
              <Link
                to="/reports"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-indigo-200/80 rounded-xl text-sm font-semibold hover:bg-indigo-50/50 transition-colors shadow-2xs"
              >
                <FileBarChart2 className="w-4 h-4 text-indigo-600" />
                <span>Generate Report</span>
              </Link>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-indigo-200/80 rounded-xl text-sm font-semibold hover:bg-indigo-50/50 transition-colors shadow-2xs"
              >
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                <span>View Documents</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Operational Status & Employee-Facing Metrics */}
        <section aria-labelledby="status-grid" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="status-grid" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Operational status
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              All systems operational
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Documents Indexed</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Ready to search
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX &amp; TXT knowledge base</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">AI Knowledge Engine</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Online
                </p>
                <p className="text-xs text-slate-500 mt-1">RAG citations + Office workflows</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Access &amp; Security</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Protected
                </p>
                <p className="text-xs text-slate-500 mt-1">JWT · Role-based permissions</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Tenant Workspace</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">WorkMesh Technologies</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  <CheckCircle2 className="w-3 h-3" />
                  Active · Isolated
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity Panel */}
        <section
          aria-labelledby="recent-activity-heading"
          className="bg-white rounded-2xl border border-indigo-100/80 shadow-2xs overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h2 id="recent-activity-heading" className="text-base font-bold text-slate-900">
                Recent activity
              </h2>
            </div>
            <Link
              to={isAdmin ? '/admin/audit-logs' : '/documents'}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ul className="divide-y divide-slate-100">
            {recentActivity.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.tone}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{item.time}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </AppShell>
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
            path="/assistant"
            element={
              <ProtectedRoute>
                <KnowledgeAssistantPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
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
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AuditLogsPage />
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
