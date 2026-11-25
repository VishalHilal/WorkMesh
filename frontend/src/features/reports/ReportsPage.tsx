import { useState, useEffect, type FormEvent } from 'react'
import {
  FileBarChart2,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useAuth } from '../../context'
import { AppHeader } from '../../components/AppHeader'
import type { GeneratedReportItem, ReportFormat, ReportTemplate } from './types'

const TEMPLATE_LABELS: Record<string, string> = {
  executive_summary: 'Executive Summary',
  policy_brief: 'Policy Brief',
  compliance_audit: 'Compliance Audit',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ReportsPage() {
  const { accessToken } = useAuth()

  const [reports, setReports] = useState<GeneratedReportItem[]>([])
  const [isLoadingList, setIsLoadingList] = useState(Boolean(accessToken))
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [template, setTemplate] = useState<ReportTemplate>('executive_summary')

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false

    async function loadReports() {
      try {
        const res = await fetch('/api/v1/reports?page=1&limit=20', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const body = (await res.json()) as {
          success?: boolean
          data?: GeneratedReportItem[]
          error?: { message?: string }
        }
        if (!res.ok) {
          throw new Error(body.error?.message ?? 'Failed to load reports.')
        }
        if (!cancelled) {
          setReports(body.data ?? [])
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false)
        }
      }
    }

    void loadReports()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!accessToken || isGenerating) return

    const trimmedTitle = title.trim()
    const trimmedPrompt = prompt.trim()
    if (!trimmedTitle || !trimmedPrompt) {
      setError('Both Report Title and Topic / Instructions are required.')
      return
    }

    setError(null)
    setSuccessMsg(null)
    setIsGenerating(true)

    try {
      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: trimmedTitle,
          prompt: trimmedPrompt,
          format,
          template,
        }),
      })

      const body = (await res.json()) as {
        success?: boolean
        data?: GeneratedReportItem
        error?: { message?: string }
      }

      if (!res.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Report generation failed.')
      }

      setReports((prev) => [body.data!, ...prev])
      setTitle('')
      setPrompt('')
      setSuccessMsg(`Report "${body.data.title}" generated successfully.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Report generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (reportId: string) => {
    if (!accessToken || downloadingId) return
    setError(null)
    setDownloadingId(reportId)

    try {
      const res = await fetch(`/api/v1/reports/${reportId}/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = (await res.json()) as {
        success?: boolean
        data?: { downloadUrl: string; fileName: string }
        error?: { message?: string }
      }

      if (!res.ok || !body.data?.downloadUrl) {
        throw new Error(body.error?.message ?? 'Failed to retrieve download URL.')
      }

      window.open(body.data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download report.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!accessToken || deletingId) return
    setError(null)
    setDeletingId(reportId)

    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = (await res.json()) as {
        success?: boolean
        error?: { message?: string }
      }

      if (!res.ok) {
        throw new Error(body.error?.message ?? 'Failed to delete report.')
      }

      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete report.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <AppHeader currentTab="reports" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Report Generation
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Synthesize executive PDF and DOCX reports grounded in your company&apos;s authorized documents.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            Tenant-Scoped RAG Synthesis
          </span>
        </div>

        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="p-1 hover:text-rose-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              aria-label="Dismiss success"
              className="p-1 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Report Builder Form */}
          <section
            aria-label="Generate new report"
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs p-6"
          >
            <h2 className="text-sm font-bold text-slate-900 mb-4">Create New Report</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label htmlFor="report-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Report Title
                </label>
                <input
                  id="report-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q4 Remote Work & Expense Policy Brief"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label htmlFor="report-prompt" className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic & Synthesis Instructions
                </label>
                <textarea
                  id="report-prompt"
                  rows={4}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what sections, policies, or metrics should be synthesized..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="report-template" className="block text-xs font-semibold text-slate-700 mb-1">
                    Template
                  </label>
                  <select
                    id="report-template"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as ReportTemplate)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="executive_summary">Executive Summary</option>
                    <option value="policy_brief">Policy Brief</option>
                    <option value="compliance_audit">Compliance Audit</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="report-format" className="block text-xs font-semibold text-slate-700 mb-1">
                    Output Format
                  </label>
                  <select
                    id="report-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ReportFormat)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="docx">Word (.docx)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing company documents &amp; rendering report...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Report</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: Generated Reports List */}
          <section
            aria-label="Generated reports history"
            className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Generated Reports ({reports.length})
              </h2>
            </div>

            {isLoadingList ? (
              <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading reports...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No reports generated yet</p>
                <p className="text-xs text-slate-400">
                  Use the form on the left to generate your first grounded PDF or DOCX report.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {report.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            report.format === 'PDF'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {report.format}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {TEMPLATE_LABELS[report.template] ?? report.template} &bull;{' '}
                        {formatBytes(report.fileSize)} &bull;{' '}
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownload(report.id)}
                        disabled={downloadingId === report.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {downloadingId === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Download</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        aria-label={`Delete ${report.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {deletingId === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
