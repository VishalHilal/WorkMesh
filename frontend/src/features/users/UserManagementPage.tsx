import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context'
import type { UserListItem } from './types'
import { RoleBadge } from './RoleBadge'
import { RoleChangeModal } from './RoleChangeModal'
import { AppHeader } from '../../components/AppHeader'
import { SearchIcon } from '../../components/icons'

export function UserManagementPage() {
  const { user: caller, accessToken } = useAuth()
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Enterprise Unified Header */}
      <AppHeader currentTab="directory" />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full flex-1">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Employee Directory & Roles
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage employees at WorkMesh Technologies Pvt. Ltd., view roles, and adjust permissions.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-sm font-medium text-emerald-800 flex items-center justify-between"
          >
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-4 border border-rose-200 text-sm font-medium text-rose-800 flex items-center justify-between"
          >
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="user-search" className="sr-only">
              Search employees
            </label>
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="user-search"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all cursor-pointer font-medium"
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
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-6 py-3.5">Employee</th>
                <th scope="col" className="px-6 py-3.5">Role</th>
                <th scope="col" className="px-6 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs font-medium">Loading employees...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <p className="text-sm font-medium">No employees found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or role filter.</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const editable = canEditUser(u)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-800 text-xs font-bold ring-1 ring-slate-200">
                            {u.firstName[0]}
                            {u.lastName[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{u.firstName} {u.lastName}</span>
                              {caller?.id === u.id && (
                                <span className="text-[11px] font-normal text-slate-400">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50/60 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          disabled={!editable}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
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
