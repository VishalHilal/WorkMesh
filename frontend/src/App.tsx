import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './features/auth/LoginPage'
import { UserManagementPage } from './features/users/UserManagementPage'
import { DocumentManagementPage } from './features/documents/DocumentManagementPage'
import { KnowledgeAssistantPage } from './features/rag/KnowledgeAssistantPage'
import {
  FileText,
  Users,
  Database,
  ShieldCheck,
  Sparkles,
  Cpu,
} from 'lucide-react'
import './App.css'

function DashboardShell() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Enterprise Unified Header */}
      <AppHeader currentTab="workspace" />

      {/* Main Workspace Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Workspace Summary Bar */}
        <section aria-labelledby="workmesh-heading" className="bg-white rounded-xl p-6 border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-800 tracking-wide">
                  WorkMesh Enterprise Workspace
                </span>
              </div>
              <h1 id="workmesh-heading" className="text-2xl font-bold tracking-tight text-slate-900">
                Your company workspace, connected.
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Welcome back, {user?.firstName ?? 'Employee'} ({user?.role?.replace('_', ' ')}). The
                employee productivity workspace is ready.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/assistant"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Assistant</span>
              </Link>
              <Link
                to="/documents"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Document Hub</span>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/users"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Directory</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Operational Status Grid */}
        <section aria-labelledby="status-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <h2 id="status-grid" className="sr-only">System Status</h2>
          
          <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Knowledge Storage</span>
              <Database className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900">Neon Object Storage</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              S3 Path-Style Bucket
            </p>
          </div>

          <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Vector Index Engine</span>
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-base font-bold text-slate-900">pgvector HNSW</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              768-dimensional cosine index
            </p>
          </div>

          <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Tenancy Boundary</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900">Tenant Scoped</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Company ID partitioned
            </p>
          </div>

          <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">AI Ingestion Pipeline</span>
              <Cpu className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900">FastAPI & MiniLM</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ingestion online
            </p>
          </div>
        </section>

        {/* Work Hub Features */}
        <section aria-labelledby="hub-heading" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <h2 id="hub-heading" className="sr-only">Workspace Features</h2>

          {/* Document Management Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  Document Knowledge Base
                </span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Upload & Ingest Organizational Knowledge
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Add PDFs, Word documents, and text files. The AI service automatically extracts text, produces semantic chunks, and builds vector embeddings for search.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">PDF • DOCX • TXT (max 10MB)</span>
              <Link
                to="/documents"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Go to documents →
              </Link>
            </div>
          </div>

          {/* RAG Agent Live Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  RAG Knowledge Assistant
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Live & Connected
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Natural Language Knowledge Search
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Ask questions about your company's indexed policies and get cited, hallucination-resistant answers powered by vector similarity search and Google Gemini.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Gemini Flash + pgvector</span>
              <Link
                to="/assistant"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
              >
                Launch Assistant →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
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
