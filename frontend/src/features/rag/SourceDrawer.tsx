import { useEffect } from 'react'
import { X, FileText, ShieldCheck } from 'lucide-react'
import type { Citation } from './types'

interface SourceDrawerProps {
  citation: Citation | null
  onClose: () => void
}

export function SourceDrawer({ citation, onClose }: SourceDrawerProps) {
  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (citation) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [citation, onClose])

  if (!citation) return null

  const matchPercent = Math.round(citation.similarity_score * 100)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-slide-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 id="source-drawer-title" className="text-sm font-bold text-slate-900 leading-tight">
                Grounded Source Citation
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Chunk #{citation.chunk_index + 1}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close source drawer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Metadata pill cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Relevance Match
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-base font-bold text-emerald-600">{matchPercent}%</span>
                <span className="text-[11px] text-slate-500 font-medium">cosine similarity</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Verification
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-600">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">Tenant Verified</span>
              </div>
            </div>
          </div>

          {/* Document identifier */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center text-slate-500 font-mono text-[11px] mb-1">
              <span>Document ID:</span>
              <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={citation.document_id}>
                {citation.document_id}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-mono text-[11px]">
              <span>Chunk ID:</span>
              <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={citation.chunk_id}>
                {citation.chunk_id}
              </span>
            </div>
          </div>

          {/* Full Extracted Document Excerpt */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 tracking-tight flex items-center justify-between">
              <span>Retrieved Document Excerpt</span>
              <span className="text-[10px] font-normal text-slate-400">pgvector snippet</span>
            </h4>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-normal whitespace-pre-wrap selection:bg-amber-100">
              {citation.snippet}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
