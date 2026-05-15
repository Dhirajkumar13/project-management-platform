import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isPast } from 'date-fns'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatDate = (date: string | Date) => format(new Date(date), 'MMM d, yyyy')
export const formatRelativeTime = (date: string | Date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true })
export const isOverdue = (date: string | Date) => isPast(new Date(date))

export const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50 border-red-200',
  HIGH: 'text-orange-700 bg-orange-50 border-orange-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
  LOW: 'text-green-600 bg-green-50 border-green-200',
}

export const PRIORITY_DOTS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
}

export const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'text-gray-600 bg-gray-100',
  TODO: 'text-blue-600 bg-blue-50',
  IN_PROGRESS: 'text-indigo-600 bg-indigo-50',
  IN_REVIEW: 'text-purple-600 bg-purple-50',
  DONE: 'text-green-600 bg-green-50',
}

export const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const ROLE_COLORS: Record<string, string> = {
  OWNER: 'text-red-700 bg-red-50',
  ADMIN: 'text-orange-700 bg-orange-50',
  MANAGER: 'text-blue-700 bg-blue-50',
  MEMBER: 'text-green-700 bg-green-50',
  VIEWER: 'text-gray-700 bg-gray-50',
}

export const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
]

export const getAvatarColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
