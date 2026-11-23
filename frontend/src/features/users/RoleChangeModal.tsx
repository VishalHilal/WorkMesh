import { useState } from 'react'
import type { UserListItem } from './types'

interface RoleChangeModalProps {
  user: UserListItem
  callerRole: 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'
  accessToken: string
  onClose: () => void
  onSuccess: (updatedUser: UserListItem) => void
}

export function RoleChangeModal({
  user,
  callerRole,
  accessToken,
  onClose,
  onSuccess,
}: RoleChangeModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserListItem['role']>(user.role)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableRoles: UserListItem['role'][] =
    callerRole === 'SUPER_ADMIN'
      ? ['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
      : ['EMPLOYEE', 'MANAGER', 'ADMIN']

  const handleSave = async () => {
    if (selectedRole === user.role) {
      onClose()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to update user role.')
      }

      onSuccess(body.data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating role.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <h3 id="modal-title" className="text-lg font-semibold text-slate-900">
          Change Role for {user.firstName} {user.lastName}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200"
          >
            {error}
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="role-select" className="block text-sm font-medium text-slate-700">
            Select Role
          </label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserListItem['role'])}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || selectedRole === user.role}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Updating...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
