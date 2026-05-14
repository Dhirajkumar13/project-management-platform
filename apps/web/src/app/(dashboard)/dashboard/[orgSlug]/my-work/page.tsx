'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useAuthStore } from '@/store/auth.store'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import { Task, TaskStatus } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_DOTS, formatDate, isOverdue } from '@/lib/utils'
import { CheckSquare, Calendar, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

const STATUS_FILTERS: { label: string; value: TaskStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Backlog', value: 'BACKLOG' },
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Done', value: 'DONE' },
]

interface MyTask extends Task {
  project: { id: string; name: string; organizationId: string }
}

export default function MyWorkPage({ params }: { params: { orgSlug: string } }) {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks', currentOrg?.id, statusFilter],
    queryFn: () =>
      api.get('/my-tasks', {
        params: { orgId: currentOrg?.id, status: statusFilter || undefined },
      }).then((r) => r.data.data.tasks as MyTask[]),
    enabled: !!currentOrg?.id,
  })

  const overdue = data?.filter((t) => t.dueDate && isOverdue(t.dueDate) && t.status !== 'DONE') ?? []
  const upcoming = data?.filter((t) => t.dueDate && !isOverdue(t.dueDate) && t.status !== 'DONE') ?? []
  const noDue = data?.filter((t) => !t.dueDate && t.status !== 'DONE') ?? []
  const done = data?.filter((t) => t.status === 'DONE') ?? []

  const grouped = statusFilter
    ? [{ label: STATUS_LABELS[statusFilter], tasks: data ?? [] }]
    : [
        overdue.length > 0 ? { label: 'Overdue', tasks: overdue, danger: true } : null,
        upcoming.length > 0 ? { label: 'Upcoming', tasks: upcoming } : null,
        noDue.length > 0 ? { label: 'No due date', tasks: noDue } : null,
        done.length > 0 ? { label: 'Completed', tasks: done } : null,
      ].filter(Boolean) as { label: string; tasks: MyTask[]; danger?: boolean }[]

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="My Work" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />}
            <span className="text-gray-500 text-sm">{data?.length ?? 0} tasks assigned to you</span>
          </div>
          <div className="flex gap-2">
            {STATUS_FILTERS.map(({ label, value }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : data?.length === 0 ? (
          <div className="text-center py-16">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No tasks assigned to you</h3>
            <p className="text-gray-400 text-sm">Tasks assigned to you will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  {group.danger && <AlertCircle className="w-4 h-4 text-red-500" />}
                  <h3 className={cn('text-sm font-semibold', group.danger ? 'text-red-600' : 'text-gray-700')}>
                    {group.label}
                  </h3>
                  <span className="text-xs text-gray-400">({group.tasks.length})</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {group.tasks.map((task, idx) => (
                    <div key={task.id}
                      className={cn('flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors', idx > 0 && 'border-t border-gray-50')}>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Link href={`/dashboard/${params.orgSlug}/projects/${task.project.id}/kanban`}
                            className="hover:text-indigo-600">{task.project.name}</Link>
                        </p>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className={cn('flex items-center gap-1 text-xs flex-shrink-0',
                          isOverdue(task.dueDate) && task.status !== 'DONE' ? 'text-red-500' : 'text-gray-400')}>
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task._count && task._count.comments > 0 && (
                        <span className="text-xs text-gray-400 flex-shrink-0">{task._count.comments} comments</span>
                      )}
                    </div>
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
