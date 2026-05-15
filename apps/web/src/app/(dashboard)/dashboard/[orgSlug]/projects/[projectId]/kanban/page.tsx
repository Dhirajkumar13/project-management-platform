'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, DragEndEvent, DragStartEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, useDroppable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useOrgStore } from '@/store/org.store'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import api from '@/lib/api'
import { Task, TaskStatus, Priority, KanbanBoard, Label, ProjectMember } from '@/types'
import {
  cn, PRIORITY_DOTS, STATUS_LABELS, formatDate, isOverdue
} from '@/lib/utils'
import { Plus, MessageSquare, Calendar, Filter, X, LayoutDashboard, List, LayoutGrid } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { TaskDetailModal } from '@/components/modals/TaskDetailModal'
import { ErrorState } from '@/components/ui/ErrorState'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { ProjectStatusBadge } from '@/components/ui/ProjectStatusBadge'
import Link from 'next/link'

const COLUMNS: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
const COLUMN_COLORS: Record<TaskStatus, string> = {
  BACKLOG: 'border-gray-300',
  TODO: 'border-blue-300',
  IN_PROGRESS: 'border-indigo-400',
  IN_REVIEW: 'border-purple-400',
  DONE: 'border-green-400',
}

const createSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>


function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', PRIORITY_DOTS[task.priority])} aria-hidden="true" />
        <span className="sr-only">{task.priority.toLowerCase()} priority</span>
        <p className="text-sm text-gray-800 dark:text-slate-200 font-medium leading-snug flex-1 line-clamp-2">{task.title}</p>
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((l) => (
            <span key={l.labelId} className="text-xs px-1.5 py-0.5 rounded text-white font-medium"
              style={{ backgroundColor: l.label.color }}>
              {l.label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={cn('text-xs flex items-center gap-0.5', isOverdue(task.dueDate) && task.status !== 'DONE' ? 'text-red-500' : 'text-gray-400')}>
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(task._count?.comments ?? 0) > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />{task._count!.comments}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} name={a.user.name} avatarUrl={a.user.avatarUrl} size="xs" className="ring-1 ring-white" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Column({
  status, tasks, orgId, projectId, onTaskClick, onAddTask
}: {
  status: TaskStatus; tasks: Task[]; orgId: string; projectId: string
  onTaskClick: (task: Task) => void; onAddTask: (status: TaskStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex-shrink-0 w-72">
      <div ref={setNodeRef} className={cn('bg-gray-50 dark:bg-slate-800/60 rounded-xl border-t-4 flex flex-col max-h-full transition-colors', COLUMN_COLORS[status], isOver && 'bg-indigo-50 dark:bg-indigo-900/20')}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{STATUS_LABELS[status]}</span>
            <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full px-2 py-0.5 font-medium">{tasks.length}</span>
          </div>
          <button
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${STATUS_LABELS[status]}`}
            className="text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded hover:bg-white dark:hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-24">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

export default function KanbanPage({ params }: { params: { orgSlug: string; projectId: string } }) {
  const { orgId: _orgId } = { orgId: '' }
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const orgId = currentOrg?.id ?? ''
  const { projectId } = params

  useProjectSocket(projectId, orgId)

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addingToColumn, setAddingToColumn] = useState<TaskStatus | null>(null)
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const qc = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { data: project } = useQuery({
    queryKey: ['project', orgId, projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${projectId}`)
        .then((r) => r.data.data as { name: string; status: string }),
    enabled: !!orgId,
  })

  const { data: board, isLoading, isError, refetch } = useQuery({
    queryKey: ['kanban', projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${projectId}/tasks/kanban`)
        .then((r) => r.data.data as KanbanBoard),
    enabled: !!orgId,
  })

  const { data: members } = useQuery({
    queryKey: ['project-members', orgId, projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${projectId}/members`)
        .then((r) => r.data.data as ProjectMember[]),
    enabled: !!orgId,
  })

  const { data: labels } = useQuery({
    queryKey: ['project-labels', orgId, projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${projectId}/labels`)
        .then((r) => r.data.data as Label[]),
    enabled: !!orgId,
  })

  const filteredBoard = useMemo((): KanbanBoard | undefined => {
    if (!board) return undefined
    const hasFilter = filterPriority || filterAssignee || filterLabel
    if (!hasFilter) return board
    const filter = (tasks: Task[]) => tasks.filter((task) => {
      if (filterPriority && task.priority !== filterPriority) return false
      if (filterAssignee && !task.assignees?.some((a) => a.userId === filterAssignee)) return false
      if (filterLabel && !task.labels?.some((l) => l.labelId === filterLabel)) return false
      return true
    })
    return Object.fromEntries(COLUMNS.map((s) => [s, filter(board[s] ?? [])])) as unknown as KanbanBoard
  }, [board, filterPriority, filterAssignee, filterLabel])

  const activeBoard = filteredBoard ?? board

  const hasActiveFilter = !!(filterPriority || filterAssignee || filterLabel)
  const clearFilters = () => { setFilterPriority(''); setFilterAssignee(''); setFilterLabel('') }

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status, position }: { taskId: string; status: TaskStatus; position: number }) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}/move`, { status, position }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban', projectId] }),
    onError: () => {
      toast.error('Failed to move task')
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
    },
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting, errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { priority: 'MEDIUM' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateForm & { status: TaskStatus; assigneeIds: string[] }) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      setAddingToColumn(null)
      setSelectedAssigneeIds([])
      reset()
      toast.success('Task created!')
    },
    onError: () => toast.error('Failed to create task'),
  })

  const handleDragStart = ({ active }: DragStartEvent) => {
    for (const status of COLUMNS) {
      const task = board?.[status]?.find((t) => t.id === active.id)
      if (task) { setActiveTask(task); break }
    }
  }

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over || !board) return

    let sourceStatus: TaskStatus | null = null
    for (const status of COLUMNS) {
      if (board[status].find((t) => t.id === active.id)) { sourceStatus = status; break }
    }
    if (!sourceStatus) return

    let destStatus: TaskStatus | null = null
    for (const status of COLUMNS) {
      if (status === over.id || board[status].find((t) => t.id === over.id)) {
        destStatus = status; break
      }
    }
    if (!destStatus) return

    const destTasks = board[destStatus]
    const overTaskIndex = destTasks.findIndex((t) => t.id === over.id)
    const newPosition = overTaskIndex >= 0
      ? (overTaskIndex === 0 ? destTasks[0].position / 2 : (destTasks[overTaskIndex - 1].position + destTasks[overTaskIndex].position) / 2)
      : (destTasks.length > 0 ? destTasks[destTasks.length - 1].position + 1000 : 1000)

    qc.setQueryData(['kanban', projectId], (old: KanbanBoard | undefined) => {
      if (!old) return old
      const task = old[sourceStatus!].find((t) => t.id === active.id)!
      return {
        ...old,
        [sourceStatus!]: old[sourceStatus!].filter((t) => t.id !== active.id),
        [destStatus!]: [...old[destStatus!].filter((t) => t.id !== active.id), { ...task, status: destStatus, position: newPosition }]
          .sort((a, b) => a.position - b.position),
      }
    })

    moveMutation.mutate({ taskId: active.id as string, status: destStatus, position: newPosition })
  }, [board, projectId, qc, moveMutation])

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-indigo-600 rounded-full border-t-transparent" /></div>
  const backHref = `/dashboard/${params.orgSlug}/projects/${projectId}`

  const statusBadge = project && orgId ? (
    <ProjectStatusBadge orgId={orgId} projectId={projectId} status={project.status ?? 'ACTIVE'} />
  ) : null

  if (isError) return <div className="flex-1"><Header title={project?.name ?? 'Kanban Board'} subtitle={project ? 'Kanban Board' : undefined} backHref={backHref} /><ErrorState onRetry={refetch} /></div>
  if (!board || !activeBoard) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title={project?.name ?? 'Kanban Board'} subtitle={project ? 'Kanban Board' : undefined} backHref={backHref} titleSuffix={statusBadge} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 flex-wrap">
        {/* Filters toggle chip */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors',
            showFilters || hasActiveFilter
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilter && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
              {[filterPriority, filterAssignee, filterLabel].filter(Boolean).length}
            </span>
          )}
        </button>

        {showFilters && (
          <>
            <SelectDropdown
              variant="chip"
              placeholder="Priority"
              value={filterPriority}
              onChange={(v) => setFilterPriority(v as Priority | '')}
              options={(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => ({ label: p, value: p }))}
            />
            <SelectDropdown
              variant="chip"
              placeholder="Assignee"
              value={filterAssignee}
              onChange={setFilterAssignee}
              options={(members ?? []).map((m) => ({ label: m.user.name, value: m.userId }))}
            />
            <SelectDropdown
              variant="chip"
              placeholder="Label"
              value={filterLabel}
              onChange={setFilterLabel}
              options={(labels ?? []).map((l) => ({ label: l.name, value: l.id, color: l.color }))}
            />
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </>
        )}

        {/* View switcher */}
        <div className="ml-auto flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
          <Link
            href={`/dashboard/${params.orgSlug}/projects/${projectId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </Link>
          <Link
            href={`/dashboard/${params.orgSlug}/projects/${projectId}/list`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <List className="w-3.5 h-3.5" /> List
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm">
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-h-0">
            {COLUMNS.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={activeBoard[status] ?? []}
                orgId={orgId}
                projectId={projectId}
                onTaskClick={setSelectedTask}
                onAddTask={setAddingToColumn}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} onClick={() => {}} />}
          </DragOverlay>
        </DndContext>
      </div>

      <Modal isOpen={!!addingToColumn} onClose={() => { setAddingToColumn(null); setSelectedAssigneeIds([]); reset() }} title={`Add task to ${addingToColumn ? STATUS_LABELS[addingToColumn] : ''}`}>
        <form
          onSubmit={handleSubmit((d) => createMutation.mutate({
            ...d,
            status: addingToColumn!,
            assigneeIds: selectedAssigneeIds,
            dueDate: d.dueDate || undefined,
            description: d.description || undefined,
          }))}
          className="p-6 space-y-4"
        >
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title *</label>
            <input id="task-title" {...register('title')} placeholder="Task title" autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-desc" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
            <textarea id="task-desc" {...register('description')} rows={3} placeholder="Optional description…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {/* Priority + Due Date side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Priority</label>
              <SelectDropdown
                value={watch('priority') ?? 'MEDIUM'}
                onChange={(v) => setValue('priority', v as CreateForm['priority'])}
                options={[
                  { label: 'Low', value: 'LOW' },
                  { label: 'Medium', value: 'MEDIUM' },
                  { label: 'High', value: 'HIGH' },
                  { label: 'Critical', value: 'CRITICAL' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="task-due" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Due Date</label>
              <input id="task-due" type="date" {...register('dueDate')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Assignees */}
          {members && members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Assignees</label>
              <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg p-2">
                {members.map((m) => (
                  <label key={m.userId} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedAssigneeIds.includes(m.userId)}
                      onChange={(e) =>
                        setSelectedAssigneeIds((prev) =>
                          e.target.checked ? [...prev, m.userId] : prev.filter((id) => id !== m.userId)
                        )
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="xs" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{m.user.name}</span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">{m.role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setAddingToColumn(null); setSelectedAssigneeIds([]); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create Task</Button>
          </div>
        </form>
      </Modal>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          orgId={orgId}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => qc.invalidateQueries({ queryKey: ['kanban', projectId] })}
        />
      )}
    </div>
  )
}
