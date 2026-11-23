import type { UserListItem } from './types'

interface RoleBadgeProps {
  role: UserListItem['role']
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const styles: Record<UserListItem['role'], string> = {
    SUPER_ADMIN: 'bg-purple-50 text-purple-700 ring-purple-700/10',
    ADMIN: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
    MANAGER: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    EMPLOYEE: 'bg-slate-50 text-slate-700 ring-slate-600/10',
  }

  const labels: Record<UserListItem['role'], string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles[role]}`}
    >
      {labels[role]}
    </span>
  )
}
