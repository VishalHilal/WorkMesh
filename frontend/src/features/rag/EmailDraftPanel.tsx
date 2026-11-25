import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { approveDraft, rejectDraft } from '../../services/api'
import type { EmailDraftPayload } from './types'

interface EmailDraftPanelProps {
  draft: EmailDraftPayload
  accessToken: string
}

type PanelStatus = 'pending' | 'approved' | 'rejected'

export function EmailDraftPanel({ draft, accessToken }: EmailDraftPanelProps) {
  const [status, setStatus] = useState<PanelStatus>('pending')
  const [inFlight, setInFlight] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const handleApprove = async () => {
    if (inFlight) return
    setError(null)
    setInFlight('approve')
    try {
      await approveDraft(draft.approval_token, accessToken)
      setStatus('approved')
      setToast('✅ Email approved and queued')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve email draft.')
    } finally {
      setInFlight(null)
    }
  }

  const handleReject = async () => {
    if (inFlight) return
    setError(null)
    setInFlight('reject')
    try {
      await rejectDraft(draft.approval_token, accessToken)
      setStatus('rejected')
      setToast('🗑 Draft discarded')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to discard email draft.')
    } finally {
      setInFlight(null)
    }
  }

  if (status === 'rejected') {
    return (
      <div
        role="status"
        className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-xs text-slate-600"
      >
        <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span>{toast ?? '🗑 Draft discarded'}</span>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div
        role="status"
        className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-800"
      >
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toast ?? '✅ Email approved and queued'}</span>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
          Sent Confirmation Queued
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid="email-draft-panel"
      className="mt-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-2xs space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900">
            Email Draft — Human Approval Required
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Pending Review
        </span>
      </div>

      {/* Read-only Draft Fields */}
      <dl className="space-y-1.5 text-xs">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold text-slate-500 w-16 shrink-0">To:</dt>
          <dd className="text-slate-900 font-medium break-all">{draft.to}</dd>
        </div>
        {draft.cc.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-slate-500 w-16 shrink-0">CC:</dt>
            <dd className="text-slate-700 break-all">{draft.cc.join(', ')}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold text-slate-500 w-16 shrink-0">Subject:</dt>
          <dd className="text-slate-900 font-semibold">{draft.subject}</dd>
        </div>
      </dl>

      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
        {draft.body}
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleApprove}
            className="font-semibold underline hover:text-rose-900 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleReject}
          disabled={inFlight !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {inFlight === 'reject' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          <span>Reject</span>
        </button>

        <button
          type="button"
          onClick={handleApprove}
          disabled={inFlight !== null}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
        >
          {inFlight === 'approve' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          <span>Approve</span>
        </button>
      </div>
    </div>
  )
}
