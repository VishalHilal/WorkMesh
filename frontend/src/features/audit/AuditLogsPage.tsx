import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context'
import { AppShell } from '../../components/AppShell'
import type { AuditLogItem, AuditLogsResponse } from './types'
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  FilePlus,
  Trash2,
  RotateCcw,
  Sparkles,
  Info,
  X,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Globe,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export function AuditLogsPage() {
  const { accessToken } = useAuth()
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Pagination
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Selected Log for JSON Metadata Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const fetchAuditLogs = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '15')
      if (actionFilter !== 'ALL') {
        params.set('action', actionFilter)
      }

      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body: AuditLogsResponse & { error?: { message: string } } = await res.json()

      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to load security audit trail.')
      }

      setLogs(body.data)
      setTotalPages(body.meta.totalPages || 1)
      setTotalCount(body.meta.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching audit logs.')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, page, actionFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs()
    }, 50)
    return () => clearTimeout(timer)
  }, [fetchAuditLogs])

  const handleActionChange = (action: string) => {
    setActionFilter(action)
    setPage(1)
  }

  // Filter logs locally if user types in search box (search by user email, name, action, or entity ID)
  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    const userName = log.user ? `${log.user.firstName} ${log.user.lastName}`.toLowerCase() : ''
    const userEmail = log.user?.email.toLowerCase() ?? ''
    const action = log.action.toLowerCase()
    const entityId = log.entityId?.toLowerCase() ?? ''
    const entityType = log.entityType.toLowerCase()

    return (
      userName.includes(term) ||
      userEmail.includes(term) ||
      action.includes(term) ||
      entityId.includes(term) ||
      entityType.includes(term)
    )
  })

  // Format Action Badge with Icon
  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'AUTH_LOGIN_SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Login Success</span>
          </span>
        )
      case 'AUTH_LOGIN_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Login Failed</span>
          </span>
        )
      case 'USER_ROLE_CHANGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Role Modified</span>
          </span>
        )
      case 'DOCUMENT_UPLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FilePlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Doc Uploaded</span>
          </span>
        )
      case 'DOCUMENT_DELETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Doc Deleted</span>
          </span>
        )
      case 'DOCUMENT_REINGESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Doc Reingested</span>
          </span>
        )
      case 'RAG_QUERY_EXECUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>RAG Query</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>{action}</span>
          </span>
        )
    }
  }

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      }
    } catch {
      return { date: dateString, time: '' }
    }
  }

  return (
    <AppShell currentTab="audit">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[11px] font-semibold text-indigo-700 tracking-wide uppercase">
                  Security & Compliance
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Security Audit Trail
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Immutable, append-only record of authentication, access changes, and security events for WorkMesh Technologies Pvt. Ltd.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchAuditLogs()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Trail</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'AUTH_LOGIN_SUCCESS', label: 'Logins' },
              { id: 'AUTH_LOGIN_FAILED', label: 'Failed Logins' },
              { id: 'USER_ROLE_CHANGED', label: 'Role Changes' },
              { id: 'DOCUMENT_UPLOADED', label: 'Uploads' },
              { id: 'DOCUMENT_DELETED', label: 'Deletions' },
              { id: 'DOCUMENT_REINGESTED', label: 'Re-ingests' },
              { id: 'RAG_QUERY_EXECUTED', label: 'RAG Queries' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleActionChange(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  actionFilter === tab.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor or details..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-colors"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchAuditLogs()}
              className="font-semibold underline hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3 px-4">Timestamp</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Actor</th>
                  <th scope="col" className="py-3 px-4">Entity</th>
                  <th scope="col" className="py-3 px-4">Network IP</th>
                  <th scope="col" className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <p className="text-xs font-medium">Loading audit events...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Database className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No audit events found</p>
                        <p className="text-xs text-slate-400">
                          {actionFilter !== 'ALL' || search
                            ? 'No logs matched the selected action filter or search query.'
                            : 'No security audit events have been logged yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const ts = formatTimestamp(log.createdAt)
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{ts.time}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pl-5">{ts.date}</div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderActionBadge(log.action)}
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4">
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                {log.user.firstName?.[0]?.toUpperCase() ?? 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800 leading-none">
                                  {log.user.firstName} {log.user.lastName}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                                  {log.user.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <User className="w-3.5 h-3.5" />
                              <span className="italic">System / Anonymous</span>
                            </div>
                          )}
                        </td>

                        {/* Entity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {log.entityType}
                          </span>
                          {log.entityId && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5" title={log.entityId}>
                              {log.entityId.slice(0, 8)}…
                            </span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{log.ipAddress || '—'}</span>
                          </div>
                        </td>

                        {/* Details Modal Trigger */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {log.details ? (
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
                            >
                              View Payload
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{filteredLogs.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalCount}</span> total events
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* JSON Metadata Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Audit Payload Inspector</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Action</span>
                    <span className="font-mono font-medium text-slate-800">{selectedLog.action}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Entity</span>
                    <span className="font-mono font-medium text-slate-800">
                      {selectedLog.entityType} ({selectedLog.entityId?.slice(0, 8) || 'N/A'})
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">
                    Structured Payload
                  </span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60 border border-slate-800">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}
