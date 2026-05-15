'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useAuthStore } from '@/store/auth.store'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import api from '@/lib/api'
import { Task, TaskStatus } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_DOTS, formatDate, isOverdue } from '@/lib/utils'
import { CheckSquare, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const STATUS_FILTERS: { label: string; value: TaskStatus | '' }[] = [
  { label: 'All',        value: '' },
  { label: 'Backlog',    value: 'BACKLOG' },
  { label: 'To Do',      value: 'TODO' },
  { label: 'In Progress',value: 'IN_PROGRESS' },
  { label: 'In Review',  value: 'IN_REVIEW' },
  { label: 'Done',       value: 'DONE' },
]

interface MyTask extends Task {
  project: { id: string; name: string; organizationId: string }
}

export default function MyWorkPage({ params }: { params: { orgSlug: string } }) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const { user } = useAuthStore()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tasks', currentOrg?.id, statusFilter],
    queryFn: () =>
      api.get('/my-tasks', {
        params: { orgId: currentOrg?.id, status: statusFilter || undefined },
      }).then((r) => r.data.data.tasks as MyTask[]),
    enabled: !!currentOrg?.id,
  })

  const overdue  = data?.filter((t) => t.dueDate && isOverdue(t.dueDate) && t.status !== 'DONE') ?? []
  const upcoming = data?.filter((t) => t.dueDate && !isOverdue(t.dueDate) && t.status !== 'DONE') ?? []
  const noDue    = data?.filter((t) => !t.dueDate && t.status !== 'DONE') ?? []
  const done     = data?.filter((t) => t.status === 'DONE') ?? []

  const grouped = statusFilter
    ? [{ label: STATUS_LABELS[statusFilter], tasks: data ?? [] }]
    : [
        overdue.length  > 0 ? { label: 'Overdue',      tasks: overdue,  danger: true } : null,
        upcoming.length > 0 ? { label: 'Upcoming',     tasks: upcoming } : null,
        noDue.length    > 0 ? { label: 'No due date',  tasks: noDue } : null,
        done.length     > 0 ? { label: 'Completed',    tasks: done } : null,
      ].filter(Boolean) as { label: string; tasks: MyTask[]; danger?: boolean }[]

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="My Work" />
      <div className="p-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />}
            <span className="text-gray-500 dark:text-zinc-400 text-sm">
              {data?.length ?? 0} tasks assigned to you
            </span>
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === value
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-white dark:bg-surface-card text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-surface-elevated'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : data?.length === 0 ? (
          <div className="text-center py-16">
            <CheckSquare className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-600 dark:text-zinc-300 mb-1">No tasks assigned to you</h3>
            <p className="text-gray-400 dark:text-zinc-500 text-xs">Tasks assigned to you will appear here</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.danger && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  <h3 className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    group.danger ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'
                  )}>
                    {group.label}
                  </h3>
                  <span className="text-xs text-gray-400 dark:text-zinc-600">({group.tasks.length})</span>
                </div>

                {/* Task list */}
                <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card overflow-hidden">
                  {group.tasks.map((task, idx) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/${params.orgSlug}/projects/${task.project.id}/tasks/${task.id}`}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors group',
                        idx > 0 && 'border-t border-gray-50 dark:border-white/[0.04]'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority])} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{task.project.name}</p>
                      </div>

                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>

                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>

                      {task.dueDate && (
                        <span className={cn(
                          'flex items-center gap-1 text-xs flex-shrink-0',
                          isOverdue(task.dueDate) && task.status !== 'DONE'
                            ? 'text-red-500'
                            : 'text-gray-400 dark:text-zinc-500'
                        )}>
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}

                      {(task._count?.comments ?? 0) > 0 && (
                        <span className="text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0">
                          {task._count!.comments} comments
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
