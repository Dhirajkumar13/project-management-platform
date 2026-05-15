'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { Task, TaskStatus, Priority } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_DOTS, formatDate, isOverdue, hasOrgRole } from '@/lib/utils'
import { Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, LayoutDashboard, List } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/ui/ProjectStatusBadge'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import Link from 'next/link'
import toast from 'react-hot-toast'

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const STATUS_ORDER: Record<TaskStatus, number> = { BACKLOG: 0, TODO: 1, IN_PROGRESS: 2, IN_REVIEW: 3, DONE: 4 }

export default function TaskListPage({ params }: { params: { orgSlug: string; projectId: string } }) {
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const qc = useQueryClient()
  const router = useRouter()

  useProjectSocket(params.projectId, currentOrg?.id ?? '')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${currentOrg!.id}/projects/${params.projectId}`)
        .then((r) => r.data.data as { name: string; status: string }),
    enabled: !!currentOrg?.id,
  })

  const { data: tasks, isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks-list', currentOrg?.id, params.projectId, statusFilter, priorityFilter],
    queryFn: () =>
      api.get(`/organizations/${currentOrg!.id}/projects/${params.projectId}/tasks`, {
        params: { limit: 200, status: statusFilter || undefined, priority: priorityFilter || undefined },
      }).then((r) => r.data.data.items as Task[]),
    enabled: !!currentOrg?.id,
  })

  const sorted = useMemo(() => {
    if (!tasks) return []
    return [...tasks].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortField === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      else if (sortField === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (sortField === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        cmp = da - db
      } else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tasks, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(sorted.map((t) => t.id)))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const bulkDelete = useMutation({
    mutationFn: () => api.post(`/organizations/${currentOrg!.id}/projects/${params.projectId}/tasks/bulk`, {
      action: 'delete', taskIds: Array.from(selected),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-list'] })
      setSelected(new Set())
      toast.success('Tasks deleted')
    },
    onError: () => toast.error('Failed to delete tasks'),
  })

  const bulkMove = (status: TaskStatus) => {
    api.post(`/organizations/${currentOrg!.id}/projects/${params.projectId}/tasks/bulk`, {
      action: 'move', taskIds: Array.from(selected), status,
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['tasks-list'] })
      setSelected(new Set())
      toast.success(`Moved to ${STATUS_LABELS[status]}`)
    }).catch(() => toast.error('Failed to move tasks'))
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-zinc-900 dark:text-zinc-100" /> : <ArrowDown className="w-3 h-3 text-zinc-900 dark:text-zinc-100" />
  }

  const exportCSV = () => {
    const token = localStorage.getItem('auth-storage')
    const parsed = token ? JSON.parse(token) : null
    const accessToken = parsed?.state?.accessToken ?? ''
    const url = `http://localhost:3001/api/v1/organizations/${currentOrg!.id}/projects/${params.projectId}/tasks/export`
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `tasks-${params.projectId}.csv`
        a.click()
      })
      .catch(() => toast.error('Export failed'))
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title={project?.name ?? 'Task List'}
        subtitle={project ? 'Task List' : undefined}
        backHref={`/dashboard/${params.orgSlug}/projects/${params.projectId}`}
        titleSuffix={project && currentOrg?.id ? (
          <ProjectStatusBadge orgId={currentOrg.id} projectId={params.projectId} status={project.status ?? 'ACTIVE'} />
        ) : undefined}
      />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SelectDropdown
              variant="chip"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as TaskStatus | '')}
              placeholder="All Statuses"
              options={(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as TaskStatus[]).map((s) => ({ label: STATUS_LABELS[s], value: s }))}
            />
            <SelectDropdown
              variant="chip"
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v as Priority | '')}
              placeholder="All Priorities"
              options={(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => ({ label: p, value: p }))}
            />

            {selected.size > 0 && hasOrgRole(currentOrg?.role, 'MEMBER') && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                <span className="text-sm text-gray-500">{selected.size} selected</span>
                <SelectDropdown
                  variant="chip"
                  value=""
                  onChange={(v) => v && bulkMove(v as TaskStatus)}
                  placeholder="Move to..."
                  options={(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as TaskStatus[]).map((s) => ({ label: STATUS_LABELS[s], value: s }))}
                />
                <button onClick={() => { if (confirm(`Delete ${selected.size} tasks?`)) bulkDelete.mutate() }}
                  className="flex items-center gap-1 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-card rounded-lg p-1">
              <Link
                href={`/dashboard/${params.orgSlug}/projects/${params.projectId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-surface-elevated transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Overview
              </Link>
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-surface-elevated text-zinc-900 dark:text-white font-medium shadow-sm">
                <List className="w-3.5 h-3.5" /> List
              </span>
              <Link
                href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/kanban`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-surface-elevated transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </Link>
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-surface-elevated">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/[0.08] bg-gray-50 dark:bg-surface-elevated/50">
                  {hasOrgRole(currentOrg?.role, 'MEMBER') && (
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer" />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('title')} className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-zinc-200">
                      Title <SortIcon field="title" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-32">
                    <button onClick={() => toggleSort('status')} className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-zinc-200">
                      Status <SortIcon field="status" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-28">
                    <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-zinc-200">
                      Priority <SortIcon field="priority" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left w-36 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Assignees</th>
                  <th className="px-4 py-3 text-left w-28">
                    <button onClick={() => toggleSort('dueDate')} className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-zinc-200">
                      Due <SortIcon field="dueDate" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center w-16 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">SP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.05]">
                {sorted.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400 dark:text-zinc-500 text-sm">No tasks found</td></tr>
                ) : sorted.map((task) => (
                  <tr key={task.id}
                    onClick={() => router.push(`/dashboard/${params.orgSlug}/projects/${params.projectId}/tasks/${task.id}`)}
                    className={cn('hover:bg-gray-50 dark:hover:bg-surface-elevated/50 transition-colors cursor-pointer', selected.has(task.id) && 'bg-zinc-100 dark:bg-surface-card/40')}>
                    {hasOrgRole(currentOrg?.role, 'MEMBER') && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleOne(task.id)}
                          className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer" />
                      </td>
                    )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority])} />
                        <Link
                          href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/tasks/${task.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-gray-900 dark:text-zinc-200 truncate max-w-xs hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        >
                          {task.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex -space-x-1">
                        {task.assignees?.slice(0, 3).map((a) => (
                          <Avatar key={a.id} name={a.user.name} avatarUrl={a.user.avatarUrl} size="xs" className="ring-2 ring-white" />
                        ))}
                        {(task.assignees?.length ?? 0) > 3 && (
                          <span className="w-6 h-6 rounded-full bg-gray-200 text-xs flex items-center justify-center ring-2 ring-white text-gray-600">
                            +{task.assignees!.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {task.dueDate ? (
                        <span className={cn('text-xs', isOverdue(task.dueDate) && task.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-500')}>
                          {formatDate(task.dueDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-500 dark:text-zinc-400">{task.storyPoints ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && sorted.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{sorted.length} tasks</p>
        )}
      </div>
    </div>
  )
}
