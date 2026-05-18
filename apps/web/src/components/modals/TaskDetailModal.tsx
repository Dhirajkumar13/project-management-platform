'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTaskSocket } from '@/hooks/useTaskSocket'
import { Task, TaskComment, TaskActivity, ProjectMember, Label } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import api from '@/lib/api'
import { cn, STATUS_LABELS, STATUS_COLORS, formatRelativeTime, formatDate, isOverdue, hasOrgRole } from '@/lib/utils'
import { useOrgStore } from '@/store/org.store'
import { X, Trash2, Send, Plus, Clock, Calendar, Pencil, Check, ChevronRight, MessageSquare, History, ListChecks } from 'lucide-react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/errors'
import ReactMarkdown from 'react-markdown'

interface Props {
  task: Task
  orgId: string
  projectId: string
  onClose: () => void
  onUpdate: () => void
}

function AddPopover<T extends { id: string }>({
  items, renderItem, onSelect, onClose,
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  onSelect: (item: T) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 min-w-max max-h-52 overflow-y-auto">
      {items.length === 0
        ? <p className="px-4 py-3 text-xs text-gray-400">Nothing to add</p>
        : items.map((item) => (
          <button key={item.id} onClick={() => { onSelect(item); onClose() }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            {renderItem(item)}
          </button>
        ))}
    </div>
  )
}

export function TaskDetailModal({ task, orgId, projectId, onClose, onUpdate }: Props) {
  const { currentOrg } = useOrgStore()
  const canEdit = hasOrgRole(currentOrg?.role, 'MEMBER')
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const [comment, setComment] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [showAddLabel, setShowAddLabel] = useState(false)
  const [localAssignees, setLocalAssignees] = useState(task.assignees ?? [])
  const [localLabels, setLocalLabels] = useState(task.labels ?? [])
  const [editingPoints, setEditingPoints] = useState(false)
  const [pointsValue, setPointsValue] = useState(String(task.storyPoints ?? ''))
  const [localStartDate, setLocalStartDate] = useState(task.startDate)
  const [localDueDate, setLocalDueDate] = useState(task.dueDate)
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [editingStartDate, setEditingStartDate] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const qc = useQueryClient()

  useTaskSocket(task.id)

  const { data: comments } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => api.get(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/comments`)
      .then((r) => r.data.data.items as TaskComment[]),
  })

  const { data: activities } = useQuery({
    queryKey: ['activities', task.id],
    queryFn: () => api.get(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/activities`)
      .then((r) => r.data.data.items as TaskActivity[]),
    enabled: activeTab === 'activity',
  })

  const { data: members } = useQuery({
    queryKey: ['project-members', orgId, projectId],
    queryFn: () => api.get(`/organizations/${orgId}/projects/${projectId}/members`)
      .then((r) => r.data.data as ProjectMember[]),
  })

  const { data: projectLabels } = useQuery({
    queryKey: ['project-labels', orgId, projectId],
    queryFn: () => api.get(`/organizations/${orgId}/projects/${projectId}/labels`)
      .then((r) => r.data.data as Label[]),
  })

  const { data: subtasks, refetch: refetchSubtasks } = useQuery({
    queryKey: ['subtasks', task.id],
    queryFn: () => api.get(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/subtasks`)
      .then((r) => r.data.data as { id: string; title: string; completed: boolean }[]),
  })

  const role = currentOrg?.role

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}`, data),
    onSuccess: () => { onUpdate(); toast.success('Task updated') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'update', resource: 'task', role })),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}`),
    onSuccess: () => { onUpdate(); onClose(); toast.success('Task deleted') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'delete', resource: 'task', role })),
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/comments`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', task.id] }); setComment('') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'add', resource: 'comment', role })),
  })

  const addAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/assignees`, { userId }),
    onSuccess: () => onUpdate(),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'add', resource: 'assignee', role })),
  })

  const removeAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/assignees/${userId}`),
    onSuccess: () => onUpdate(),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'remove', resource: 'assignee', role })),
  })

  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/labels`, { labelId }),
    onSuccess: () => onUpdate(),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'add', resource: 'label', role })),
  })

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      api.delete(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/labels/${labelId}`),
    onSuccess: () => onUpdate(),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'remove', resource: 'label', role })),
  })

  const subtaskToggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/subtasks/${id}`, { completed }),
    onSuccess: () => { refetchSubtasks(); onUpdate() },
  })

  const createSubtask = useMutation({
    mutationFn: (t: string) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/subtasks`, { title: t }),
    onSuccess: () => { refetchSubtasks(); setNewSubtask(''); onUpdate() },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'create', resource: 'subtask', role })),
  })

  const handleTitleSave = () => {
    if (title.trim() && title !== task.title) updateMutation.mutate({ title: title.trim() })
    setEditingTitle(false)
  }

  const handlePointsSave = () => {
    const n = parseInt(pointsValue, 10)
    updateMutation.mutate({ storyPoints: isNaN(n) ? undefined : n })
    setEditingPoints(false)
  }

  const subtaskList = subtasks ?? task.subtasks ?? []
  const completedSubtasks = subtaskList.filter((s) => s.completed).length
  const totalSubtasks = subtaskList.length
  const availableMembers = (members ?? []).filter((m) => !localAssignees.some((a) => a.userId === m.userId))
  const availableLabels = (projectLabels ?? []).filter((l) => !localLabels.some((tl) => tl.labelId === l.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-[88vh] bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl dark:shadow-2xl border border-transparent dark:border-white/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0 bg-gray-50/60 dark:bg-surface-card/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="font-medium text-gray-600">Projects</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-medium text-gray-600">Board</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className={cn('px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[task.status])}>
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (confirm('Delete this task?')) deleteMutation.mutate() }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT — main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-8 py-6">

            {/* Title */}
            {editingTitle ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                autoFocus
                className="w-full text-2xl font-bold text-gray-900 border-b-2 border-zinc-900 outline-none pb-1 mb-6 bg-transparent"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-zinc-700 transition-colors mb-6 leading-snug"
              >
                {task.title}
              </h2>
            )}

            {/* Description */}
            <section className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Description</h3>
              {task.description ? (
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown>{task.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No description provided.</p>
              )}
            </section>

            {/* Child Issues / Subtasks */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Child Issues</h3>
                  {totalSubtasks > 0 && (
                    <span className="text-xs text-gray-400">({completedSubtasks}/{totalSubtasks} done)</span>
                  )}
                </div>
              </div>

              {totalSubtasks > 0 && (
                <div className="h-1 bg-gray-100 rounded-full mb-3">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }} />
                </div>
              )}

              <div className="space-y-1 mb-3">
                {subtaskList.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                    <input
                      type="checkbox"
                      checked={s.completed}
                      onChange={(e) => subtaskToggle.mutate({ id: s.id, completed: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className={cn('text-sm flex-1', s.completed ? 'line-through text-gray-400' : 'text-gray-700')}>
                      {s.title}
                    </span>
                    {s.completed && <Check className="w-3.5 h-3.5 text-green-500" />}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newSubtask.trim()) createSubtask.mutate(newSubtask.trim()) }}
                  placeholder="Create child issue…"
                  className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-solid bg-transparent placeholder:text-gray-400"
                />
                {newSubtask.trim() && (
                  <button
                    onClick={() => createSubtask.mutate(newSubtask.trim())}
                    disabled={createSubtask.isPending}
                    className="px-3 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
            </section>

            {/* Activity */}
            <section>
              <div className="flex items-center gap-4 mb-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest pb-3">Activity</h3>
                <div className="flex gap-1 pb-2 ml-2">
                  {([
                    { key: 'comments', icon: MessageSquare, label: 'Comments' },
                    { key: 'activity', icon: History, label: 'History' },
                  ] as const).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                        activeTab === key
                          ? 'bg-zinc-100 text-zinc-900'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {key === 'comments' && (comments?.length ?? 0) > 0 && (
                        <span className="bg-zinc-100 text-zinc-700 rounded-full px-1.5 py-px">{comments!.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {comments?.length === 0 && (
                    <p className="text-sm text-gray-400 py-4">No comments yet. Be the first to comment.</p>
                  )}
                  {comments?.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar name={c.user.name} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{c.user.name}</span>
                          <span className="text-xs text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                          {c.content}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Comment composer — MEMBER+ only */}
                  {canEdit && (
                    <div className="flex gap-3 pt-2">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-zinc-700">Y</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && comment.trim()) commentMutation.mutate(comment.trim()) }}
                          placeholder="Add a comment… (Ctrl+Enter to submit)"
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                        />
                        {comment.trim() && (
                          <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={() => commentMutation.mutate(comment.trim())} loading={commentMutation.isPending}>
                              <Send className="w-3.5 h-3.5 mr-1" /> Submit
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {activities?.length === 0 && (
                    <p className="text-sm text-gray-400 py-4">No history yet.</p>
                  )}
                  {activities?.map((a) => (
                    <div key={a.id} className="flex gap-3 items-start">
                      <Avatar name={a.user.name} size="xs" className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">{a.user.name}</span>
                          {' '}{a.action}
                          {a.oldValue && a.newValue && (
                            <span className="text-gray-500"> · <span className="line-through">{a.oldValue}</span> → <span className="text-zinc-900 font-medium">{a.newValue}</span></span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT — sidebar */}
          <div className="w-64 flex-shrink-0 border-l border-gray-100 dark:border-white/[0.06] overflow-y-auto bg-gray-50/40 dark:bg-surface-card/30">
            <div className="px-5 py-5 space-y-6">

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Status</p>
                <SelectDropdown
                  value={task.status}
                  onChange={(v) => updateMutation.mutate({ status: v as Task['status'] })}
                  options={(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map((s) => ({ label: STATUS_LABELS[s], value: s }))}
                  className="w-full"
                />
              </div>

              {/* Assignees */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Assignees</p>
                <div className="space-y-2 mb-2">
                  {localAssignees.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Unassigned</p>
                  )}
                  {localAssignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <Avatar name={a.user.name} avatarUrl={a.user.avatarUrl} size="sm" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{a.user.name}</span>
                      <button
                        onClick={() => {
                          setLocalAssignees((prev) => prev.filter((x) => x.userId !== a.userId))
                          removeAssigneeMutation.mutate(a.userId)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowAddAssignee((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-zinc-900 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Assign member
                  </button>
                  {showAddAssignee && (
                    <AddPopover
                      items={availableMembers.map((m) => ({ ...m, id: m.userId }))}
                      renderItem={(m) => (<><Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="xs" /><span>{m.user.name}</span></>)}
                      onSelect={(m) => {
                        setLocalAssignees((prev) => [...prev, { id: m.id, taskId: task.id, userId: m.userId, user: m.user }])
                        addAssigneeMutation.mutate(m.userId)
                      }}
                      onClose={() => setShowAddAssignee(false)}
                    />
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Priority</p>
                <SelectDropdown
                  value={task.priority}
                  onChange={(v) => updateMutation.mutate({ priority: v as Task['priority'] })}
                  options={(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => ({ label: p, value: p }))}
                  className="w-full"
                />
              </div>

              {/* Labels */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Labels</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {localLabels.length === 0 && <p className="text-sm text-gray-400 italic">None</p>}
                  {localLabels.map((tl) => (
                    <div key={tl.labelId} className="flex items-center gap-1 rounded-full px-2.5 py-0.5 group"
                      style={{ backgroundColor: tl.label.color + '20', border: `1px solid ${tl.label.color}60` }}>
                      <span className="text-xs font-semibold" style={{ color: tl.label.color }}>{tl.label.name}</span>
                      <button
                        onClick={() => {
                          setLocalLabels((prev) => prev.filter((x) => x.labelId !== tl.labelId))
                          removeLabelMutation.mutate(tl.labelId)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <button onClick={() => setShowAddLabel((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-zinc-900 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add label
                  </button>
                  {showAddLabel && (
                    <AddPopover
                      items={availableLabels}
                      renderItem={(l) => (<><span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} /><span>{l.name}</span></>)}
                      onSelect={(l) => {
                        setLocalLabels((prev) => [...prev, { taskId: task.id, labelId: l.id, label: l }])
                        addLabelMutation.mutate(l.id)
                      }}
                      onClose={() => setShowAddLabel(false)}
                    />
                  )}
                </div>
              </div>

              {/* Start Date */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Start Date</p>
                {editingStartDate ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={localStartDate ? localStartDate.slice(0, 10) : task.createdAt.slice(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const iso = new Date(e.target.value).toISOString()
                        setLocalStartDate(iso)
                        updateMutation.mutate({ startDate: iso })
                      }
                      setEditingStartDate(false)
                    }}
                    onBlur={() => setEditingStartDate(false)}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-white/[0.1] rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white dark:bg-surface-elevated dark:text-white"
                  />
                ) : (
                  <button
                    onClick={() => canEdit && setEditingStartDate(true)}
                    className={cn('flex items-center gap-1.5 text-sm group text-left w-full', canEdit && 'hover:text-zinc-900 dark:hover:text-white')}
                  >
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-700 dark:text-zinc-300">
                      {formatDate(localStartDate ?? task.createdAt)}
                    </span>
                    {canEdit && <Pencil className="w-3 h-3 text-gray-300 group-hover:text-zinc-500 ml-auto transition-colors" />}
                  </button>
                )}
              </div>

              {/* Due Date */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Due Date</p>
                {editingDueDate ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={localDueDate ? localDueDate.slice(0, 10) : ''}
                    onChange={(e) => {
                      const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined
                      setLocalDueDate(iso)
                      updateMutation.mutate({ dueDate: iso })
                      setEditingDueDate(false)
                    }}
                    onBlur={() => setEditingDueDate(false)}
                    className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-white/[0.1] rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white dark:bg-surface-elevated dark:text-white"
                  />
                ) : (
                  <button
                    onClick={() => canEdit && setEditingDueDate(true)}
                    className={cn('flex items-center gap-1.5 text-sm group text-left w-full', canEdit && 'hover:text-zinc-900 dark:hover:text-white')}
                  >
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {localDueDate
                      ? <span className={cn(isOverdue(localDueDate) && task.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-700 dark:text-zinc-300')}>{formatDate(localDueDate)}</span>
                      : <span className="text-gray-400 dark:text-zinc-500 italic">{canEdit ? 'Set due date' : 'No due date'}</span>
                    }
                    {canEdit && <Pencil className="w-3 h-3 text-gray-300 group-hover:text-zinc-500 ml-auto transition-colors" />}
                  </button>
                )}
              </div>

              {/* Story Points */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Story Points</p>
                {editingPoints ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={999}
                      value={pointsValue}
                      onChange={(e) => setPointsValue(e.target.value)}
                      onBlur={handlePointsSave}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePointsSave() }}
                      autoFocus
                      className="w-20 px-2 py-1 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button onClick={handlePointsSave} className="p-1 text-zinc-900 hover:bg-zinc-100 rounded-lg">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditingPoints(true)}
                    className="flex items-center gap-2 group text-left">
                    <span className="text-sm text-gray-700 font-medium">
                      {task.storyPoints != null ? task.storyPoints : <span className="text-gray-400 font-normal italic">None</span>}
                    </span>
                    <Pencil className="w-3 h-3 text-gray-300 group-hover:text-zinc-600 transition-colors" />
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
