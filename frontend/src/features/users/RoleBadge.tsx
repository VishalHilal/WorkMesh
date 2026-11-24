import type { UserListItem } from './types'

interface RoleBadgeProps {
  role: UserListItem['role']
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const styles: Record<UserListItem['role'], string> = {
    SUPER_ADMIN: 'bg-purple-50 text-purple-700 border-purple-200/80',
    ADMIN: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    MANAGER: 'bg-sky-50 text-sky-700 border-sky-200/80',
    EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200/80',
  }

  const labels: Record<UserListItem['role'], string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${styles[role]}`}
    >
      {labels[role]}
    </span>
  )
}
