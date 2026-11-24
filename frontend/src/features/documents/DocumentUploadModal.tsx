import { useState, useRef, type FormEvent, type DragEvent, type ChangeEvent } from 'react'
import { useAuth } from '../../context'
import type { DocumentItem } from './types'
import { UploadIcon, CloseIcon } from '../../components/icons'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (document: DocumentItem) => void
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt']
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export function DocumentUploadModal({ isOpen, onClose, onSuccess }: DocumentUploadModalProps) {
  const { accessToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const validateFile = (selectedFile: File): string | null => {
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase()
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(ext)
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(selectedFile.type)

    if (!isExtensionAllowed && !isMimeAllowed) {
      return 'Invalid file type. Please upload a PDF, DOCX, or TXT document.'
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds maximum size of 10MB (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB).`
    }

    return null
  }

  const handleFileSelect = (selectedFile: File) => {
    setError(null)
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }

    setFile(selectedFile)
    if (!title.trim()) {
      // Set default title from file name without extension
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
      setTitle(nameWithoutExt)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file to upload.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (title.trim()) {
        formData.append('title', title.trim())
      }

      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to upload document.')
      }

      onSuccess(body.data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-labelledby="upload-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h2 id="upload-modal-title" className="text-lg font-bold text-slate-900">
              Upload Document
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supported formats: PDF, DOCX, TXT (up to 10MB)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close upload modal"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : file
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleInputChange}
              className="hidden"
              data-testid="document-file-input"
            />

            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500 tabular-nums">{formatFileSize(file.size)}</p>
                <p className="text-xs text-indigo-600 font-medium hover:underline pt-1">
                  Click or drag to choose a different file
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <UploadIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Click to select or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">PDF, Word DOCX, or Text (max 10MB)</p>
                </div>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label htmlFor="document-title" className="block text-sm font-semibold text-slate-700 mb-1">
              Document Title <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="document-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Employee Handbook 2026"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Document'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
