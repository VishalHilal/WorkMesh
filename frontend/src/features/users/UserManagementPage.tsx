import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context'
import type { UserListItem } from './types'
import { RoleBadge } from './RoleBadge'
import { RoleChangeModal } from './RoleChangeModal'

export function UserManagementPage() {
  const { user: caller, accessToken, logout } = useAuth()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (roleFilter !== 'ALL') params.set('role', roleFilter)

      const res = await fetch(`/api/v1/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Failed to load employees.')
      }

      setUsers(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching users.')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, search, roleFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers()
    }, 250)

    return () => clearTimeout(timer)
  }, [fetchUsers])

  const handleRoleUpdated = (updatedUser: UserListItem) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
    setSuccessMessage(`Successfully updated role for ${updatedUser.firstName} ${updatedUser.lastName}.`)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const canEditUser = (target: UserListItem): boolean => {
    if (caller?.id === target.id) return false // Cannot edit self
    if (target.role === 'SUPER_ADMIN' && caller?.role !== 'SUPER_ADMIN') return false // Only superadmin can edit superadmin
    return true
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                ← Back to Workspace
              </Link>
              <span className="text-slate-300">|</span>
              <h1 className="text-lg font-bold text-slate-900">WorkMesh Administration</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {caller?.firstName} {caller?.lastName} ({caller?.role?.replace('_', ' ')})
              </span>
              <button
                onClick={logout}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Employee Directory & Roles
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage employees at WorkMesh Technologies Pvt. Ltd., view roles, and adjust permissions.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="mt-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm font-medium text-emerald-800"
          >
            {successMessage}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 text-sm font-medium text-red-800"
          >
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="user-search" className="sr-only">
              Search employees
            </label>
            <input
              id="user-search"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:w-48">
            <label htmlFor="role-filter" className="sr-only">
              Filter by role
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    Loading employees...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const editable = canEditUser(u)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                            {u.firstName[0]}
                            {u.lastName[0]}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {u.firstName} {u.lastName}
                              {caller?.id === u.id && (
                                <span className="ml-2 text-xs font-normal text-slate-400">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setEditingUser(u)}
                          disabled={!editable}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:opacity-40 disabled:hover:text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Change role
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Role Change Modal */}
      {editingUser && caller && accessToken && (
        <RoleChangeModal
          user={editingUser}
          callerRole={caller.role as 'EMPLOYEE' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'}
          accessToken={accessToken}
          onClose={() => setEditingUser(null)}
          onSuccess={handleRoleUpdated}
        />
      )}
    </div>
  )
}
