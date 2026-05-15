'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { ProjectStatusBadge } from '@/components/ui/ProjectStatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { Project, Task, ProjectMember, TaskStatus } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, formatDate } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { CheckSquare, AlertTriangle, Users, BarChart2, Calendar, List, TrendingDown, LayoutDashboard, LayoutGrid, ArrowRight, Pencil } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const PIE_COLORS = ['#6b7280', '#3b82f6', '#6366f1', '#8b5cf6', '#22c55e']
const STATUS_ORDER: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export default function ProjectDetailPage({
  params,
}: {
  params: { orgSlug: string; projectId: string }
}) {
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const orgId = currentOrg?.id
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  useProjectSocket(params.projectId, orgId ?? '')

  const editMutation = useMutation({
    mutationFn: (data: typeof editForm) =>
      api.patch(`/organizations/${orgId}/projects/${params.projectId}`, {
        name: data.name || undefined,
        description: data.description || undefined,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', orgId, params.projectId] })
      setShowEdit(false)
      toast.success('Project updated')
    },
    onError: () => toast.error('Failed to update project'),
  })

  const { data: project, isLoading: projLoading, isError: projError, refetch } = useQuery({
    queryKey: ['project', orgId, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${params.projectId}`)
        .then((r) => r.data.data as Project & { stats: NonNullable<Project['stats']> }),
    enabled: !!orgId,
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks-all', orgId, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${params.projectId}/tasks`, { params: { limit: 200 } })
        .then((r) => r.data.data.items as Task[]),
    enabled: !!orgId,
  })

  const { data: members } = useQuery({
    queryKey: ['project-members', orgId, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${params.projectId}/members`)
        .then((r) => r.data.data as ProjectMember[]),
    enabled: !!orgId,
  })

  const { data: burndownData } = useQuery({
    queryKey: ['burndown', orgId, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${params.projectId}/burndown`)
        .then((r) => r.data.data as { date: string; remaining: number; ideal: number }[]),
    enabled: !!orgId,
  })

  if (projLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>
  if (projError) return <div className="flex-1"><Header title="Project" backHref={`/dashboard/${params.orgSlug}/projects`} /><ErrorState onRetry={refetch} /></div>
  if (!project) return null

  const stats = project.stats ?? { totalTasks: 0, completedTasks: 0, completionPercentage: 0, overdueTasks: 0 }

  const byStatus = STATUS_ORDER.map((s) => ({
    name: STATUS_LABELS[s],
    value: tasks?.filter((t) => t.status === s).length ?? 0,
    status: s,
  })).filter((s) => s.value > 0)

  const inProgress = tasks?.filter((t) => t.status === 'IN_PROGRESS').length ?? 0

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title={project.name}
        backHref={`/dashboard/${params.orgSlug}/projects`}
        titleSuffix={
          <ProjectStatusBadge
            orgId={orgId!}
            projectId={params.projectId}
            status={project.status}
          />
        }
      />
      <div className="p-6 space-y-6">
        {/* Header card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h2>
                <button
                  onClick={() => {
                    setEditForm({
                      name: project.name,
                      description: project.description ?? '',
                      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
                      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
                    })
                    setShowEdit(true)
                  }}
                  className="p-1 text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  title="Edit project"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {project.description && <p className="text-gray-500 dark:text-slate-400 text-sm">{project.description}</p>}
              {(project.startDate || project.endDate) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-slate-500">
                  {project.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Start: {formatDate(project.startDate)}</span>}
                  {project.endDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> End: {formatDate(project.endDate)}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 self-start">
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm">
                <LayoutDashboard className="w-3.5 h-3.5" /> Overview
              </span>
              <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/list`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 transition-colors">
                <List className="w-3.5 h-3.5" /> List
              </Link>
              <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/kanban`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 transition-colors">
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </Link>
            </div>
          </div>

          {/* Completion bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-slate-300 font-medium">Overall Progress</span>
              <span className="text-gray-900 dark:text-white font-bold">{stats.completionPercentage}%</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all"
                style={{ width: `${stats.completionPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Tasks', value: stats.totalTasks, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
            { label: 'Completed', value: stats.completedTasks, icon: CheckSquare, color: 'text-green-600 bg-green-50' },
            { label: 'In Progress', value: inProgress, icon: ArrowRight, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          ].map((c) => (
            <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 dark:text-slate-400 text-xs">{c.label}</span>
                <div className={cn('p-1.5 rounded-lg', c.color)}><c.icon className="w-3.5 h-3.5" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Status distribution */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Task Status Distribution</h3>
            {byStatus.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byStatus} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {byStatus.map((s, i) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-600 dark:text-slate-300">{s.name}</span>
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">No tasks yet</div>
            )}
          </div>

          {/* Team */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Team Members</h3>
              <span className="text-xs text-gray-400 dark:text-slate-500"><Users className="w-3.5 h-3.5 inline mr-1" />{members?.length ?? 0}</span>
            </div>
            <div className="space-y-3">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.user.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{member.role}</p>
                  </div>
                </div>
              ))}
              {(!members || members.length === 0) && (
                <div className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No members yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Burndown Chart */}
        {burndownData && burndownData.length > 1 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Burndown Chart</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={burndownData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number, name: string) => [value, name === 'remaining' ? 'Remaining' : 'Ideal']}
                />
                <Legend formatter={(v) => v === 'remaining' ? 'Actual remaining' : 'Ideal'} />
                <Line type="monotone" dataKey="ideal" stroke="#e5e7eb" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="remaining" stroke="#6366f1" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              onClick={() => editMutation.mutate(editForm)}
              loading={editMutation.isPending}
              disabled={!editForm.name.trim()}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
