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
import { Plus, MessageSquare, Calendar, SlidersHorizontal, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { TaskDetailModal } from '@/components/modals/TaskDetailModal'
import { ErrorState } from '@/components/ui/ErrorState'

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
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
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
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', PRIORITY_DOTS[task.priority])} aria-hidden="true" />
        <span className="sr-only">{task.priority.toLowerCase()} priority</span>
        <p className="text-sm text-gray-800 font-medium leading-snug flex-1 line-clamp-2">{task.title}</p>
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
      <div ref={setNodeRef} className={cn('bg-gray-50 rounded-xl border-t-4 flex flex-col max-h-full transition-colors', COLUMN_COLORS[status], isOver && 'bg-indigo-50')}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{STATUS_LABELS[status]}</span>
            <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">{tasks.length}</span>
          </div>
          <button
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${STATUS_LABELS[status]}`}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-white"
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
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const qc = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { priority: 'MEDIUM' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateForm & { status: TaskStatus }) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      setAddingToColumn(null)
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
  if (isError) return <div className="flex-1"><Header title="Kanban Board" /><ErrorState onRetry={refetch} /></div>
  if (!board || !activeBoard) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Kanban Board" />

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0 flex-wrap">
        <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | '')}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Priorities</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Assignees</option>
          {members?.map((m) => (
            <option key={m.userId} value={m.userId}>{m.user.name}</option>
          ))}
        </select>
        <select
          value={filterLabel}
          onChange={(e) => setFilterLabel(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Labels</option>
          {labels?.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
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

      <Modal isOpen={!!addingToColumn} onClose={() => { setAddingToColumn(null); reset() }} title={`Add task to ${addingToColumn ? STATUS_LABELS[addingToColumn] : ''}`}>
        <form onSubmit={handleSubmit((d) => createMutation.mutate({ ...d, status: addingToColumn! }))} className="p-6 space-y-4">
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input id="task-title" {...register('title')} placeholder="Task title" autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select id="task-priority" {...register('priority')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => { setAddingToColumn(null); reset() }}>Cancel</Button>
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
