import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context'
import type { DocumentItem } from './types'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { DocumentUploadModal } from './DocumentUploadModal'

export function DocumentManagementPage() {
  const { user: caller, accessToken, logout } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAdmin = caller?.role === 'ADMIN' || caller?.role === 'SUPER_ADMIN'

  const fetchDocuments = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/v1/documents?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to load documents.')
      }

      setDocuments(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching documents.')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments()
    }, 100)

    return () => clearTimeout(timer)
  }, [fetchDocuments])

  const handleDocumentUploaded = (newDoc: DocumentItem) => {
    setDocuments((prev) => [newDoc, ...prev])
    setSuccessMessage(`Document "${newDoc.title}" uploaded successfully. Status: ${newDoc.status}.`)
    setTimeout(() => setSuccessMessage(null), 5000)
  }

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to retrieve download link.')
      }

      if (body.data?.downloadUrl) {
        window.open(body.data.downloadUrl, '_blank')
      } else {
        throw new Error('Download URL could not be generated.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.title}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(doc.id)
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to delete document.')
      }

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      setSuccessMessage(`Document "${doc.title}" deleted successfully.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.')
    } finally {
      setDeletingId(null)
    }
  }

  const canDeleteDocument = (doc: DocumentItem): boolean => {
    if (isAdmin) return true
    if (caller?.id === doc.uploadedById) return true
    return false
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Primary Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <span className="text-lg font-bold text-slate-900 tracking-tight">WorkMesh AI</span>
              <nav className="flex items-center gap-4">
                <Link
                  to="/"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/documents"
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Documents
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin/users"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Manage Employees
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {caller?.firstName} ({caller?.role?.replace('_', ' ')})
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title & Primary Action */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Document Hub</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload company documents, monitor AI ingestion progress, and access internal knowledge assets.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
            >
              <span>+</span> Upload Document
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'READY', 'PROCESSING', 'PENDING', 'FAILED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={fetchDocuments}
            disabled={isLoading}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            {isLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {isLoading && documents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                📄
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No documents found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {statusFilter !== 'ALL'
                  ? `There are no documents matching the status "${statusFilter}".`
                  : 'Get started by uploading your first organizational policy or knowledge document.'}
              </p>
              {statusFilter === 'ALL' && (
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  + Upload Document
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th scope="col" className="px-6 py-3.5">Document</th>
                    <th scope="col" className="px-6 py-3.5">Size</th>
                    <th scope="col" className="px-6 py-3.5">Uploaded By</th>
                    <th scope="col" className="px-6 py-3.5">Date</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{doc.title}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{doc.fileName}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {doc.uploadedBy
                          ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`
                          : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <DocumentStatusBadge status={doc.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                            title="Download document"
                          >
                            Download
                          </button>
                          {canDeleteDocument(doc) && (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="px-2.5 py-1 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete document"
                            >
                              {deletingId === doc.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleDocumentUploaded}
      />
    </div>
  )
}
