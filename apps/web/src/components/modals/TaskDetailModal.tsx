'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTaskSocket } from '@/hooks/useTaskSocket'
import { Task, TaskComment, TaskActivity, Subtask } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import {
  cn, PRIORITY_DOTS, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS,
  formatRelativeTime, formatDate, isOverdue
} from '@/lib/utils'
import {
  X, MessageSquare, CheckSquare, Clock, Tag, User,
  Trash2, Plus, Send, History
} from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'

interface Props {
  task: Task
  orgId: string
  projectId: string
  onClose: () => void
  onUpdate: () => void
}

export function TaskDetailModal({ task, orgId, projectId, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'subtasks'>('comments')
  const [comment, setComment] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
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

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}`, data),
    onSuccess: () => { onUpdate(); toast.success('Task updated') },
    onError: () => toast.error('Failed to update task'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}`),
    onSuccess: () => { onUpdate(); onClose(); toast.success('Task deleted') },
    onError: () => toast.error('Failed to delete task'),
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] })
      setComment('')
    },
    onError: () => toast.error('Failed to add comment'),
  })

  const subtaskMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${task.id}/subtasks/${id}`, { completed }),
    onSuccess: () => onUpdate(),
  })

  const handleTitleSave = () => {
    if (title.trim() && title !== task.title) {
      updateMutation.mutate({ title: title.trim() })
    }
    setEditingTitle(false)
  }

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0
  const totalSubtasks = task.subtasks?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn('w-2.5 h-2.5 rounded-full', PRIORITY_DOTS[task.priority])} />
            <span className={cn('text-xs px-2 py-0.5 rounded font-medium', STATUS_COLORS[task.status])}>
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (confirm('Delete this task?')) deleteMutation.mutate() }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-4">
            {editingTitle ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                autoFocus
                className="w-full text-xl font-bold text-gray-900 border-b-2 border-indigo-500 outline-none pb-1"
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors"
              >
                {task.title}
              </h2>
            )}

            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Status:</span>
                <select
                  value={task.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value as Task['status'] })}
                  className="text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Priority:</span>
                <select
                  value={task.priority}
                  onChange={(e) => updateMutation.mutate({ priority: e.target.value as Task['priority'] })}
                  className="text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {task.dueDate && (
                <div className={cn('flex items-center gap-1', isOverdue(task.dueDate) && task.status !== 'DONE' ? 'text-red-500' : 'text-gray-500')}>
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(task.dueDate)}
                </div>
              )}
            </div>

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-gray-500 text-sm">Assignees:</span>
                <div className="flex -space-x-1">
                  {task.assignees.map((a) => (
                    <Avatar key={a.id} name={a.user.name} avatarUrl={a.user.avatarUrl} size="sm" className="ring-2 ring-white" />
                  ))}
                </div>
              </div>
            )}

            {task.labels && task.labels.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {task.labels.map((l) => (
                  <span key={l.labelId} className="text-xs px-2 py-0.5 rounded text-white font-medium"
                    style={{ backgroundColor: l.label.color }}>
                    {l.label.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {task.description && (
            <div className="px-6 pb-4 border-t border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Description</h3>
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{task.description}</ReactMarkdown>
              </div>
            </div>
          )}

          {totalSubtasks > 0 && (
            <div className="px-6 pb-4 border-t border-gray-50">
              <div className="flex items-center justify-between mt-4 mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Subtasks ({completedSubtasks}/{totalSubtasks})
                </h3>
              </div>
              <div className="h-1 bg-gray-100 rounded-full mb-3">
                <div className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: totalSubtasks ? `${(completedSubtasks / totalSubtasks) * 100}%` : '0%' }} />
              </div>
              <div className="space-y-1">
                {task.subtasks?.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={(e) => subtaskMutation.mutate({ id: subtask.id, completed: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={cn('text-sm', subtask.completed ? 'line-through text-gray-400' : 'text-gray-700')}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 border-t border-gray-100">
            <div className="flex gap-1 mt-4 mb-3">
              {(['comments', 'activity', 'subtasks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors',
                    activeTab === tab ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'comments' && (
              <div className="space-y-3 pb-4">
                {comments?.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.user.name} size="sm" />
                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-800">{c.user.name}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
                {comments?.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2 pb-4">
                {activities?.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <Avatar name={a.user.name} size="xs" className="mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">{a.user.name}</span> {a.action}
                        {a.oldValue && a.newValue && (
                          <span> from <span className="line-through text-gray-400">{a.oldValue}</span> to <span className="text-indigo-600">{a.newValue}</span></span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{formatRelativeTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {activeTab === 'comments' && (
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && comment.trim()) {
                    commentMutation.mutate(comment.trim())
                  }
                }}
                placeholder="Add a comment... (Ctrl+Enter to submit)"
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <Button
                size="sm"
                onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
                loading={commentMutation.isPending}
                disabled={!comment.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
