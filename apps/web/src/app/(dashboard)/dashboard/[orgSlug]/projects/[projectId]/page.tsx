'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useOrgStore } from '@/store/org.store'
import { useThemeStore, resolveTheme } from '@/store/theme.store'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { ProjectStatusBadge } from '@/components/ui/ProjectStatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { Project, Task, ProjectMember, TaskStatus, Label, OrgMember, ProjectRole } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, formatDate, hasOrgRole } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { CheckSquare, AlertTriangle, Users, BarChart2, Calendar, List, TrendingDown, LayoutDashboard, LayoutGrid, ArrowRight, Pencil, Trash2, Plus, Tag, X } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).default('BACKLOG'),
  dueDate: z.string().optional(),
})
type CreateTaskForm = z.infer<typeof createTaskSchema>

const PIE_COLORS = ['#71717a', '#3b82f6', '#2563eb', '#f59e0b', '#10b981']
const STATUS_ORDER: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export default function ProjectDetailPage({
  params,
}: {
  params: { orgSlug: string; projectId: string }
}) {
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const orgId = currentOrg?.id
  const role = currentOrg?.role
  const isDark = resolveTheme(useThemeStore((s) => s.preference)) === 'dark'
  const router = useRouter()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', startDate: '', endDate: '' })
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [selectedTaskLabelIds, setSelectedTaskLabelIds] = useState<string[]>([])

  const { register: regTask, handleSubmit: handleTask, reset: resetTask, watch: watchTask, setValue: setTaskVal, formState: { errors: taskErrors, isSubmitting: taskSubmitting } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: 'MEDIUM', status: 'BACKLOG' },
  })

  const createTaskMutation = useMutation({
    mutationFn: (d: CreateTaskForm) => api.post(`/organizations/${orgId}/projects/${params.projectId}/tasks`, {
      ...d,
      dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : undefined,
      labelIds: selectedTaskLabelIds,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-all', orgId, params.projectId] })
      qc.invalidateQueries({ queryKey: ['project', orgId, params.projectId] })
      setShowCreateTask(false)
      resetTask()
      setSelectedTaskLabelIds([])
      toast.success('Task created!')
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'create', resource: 'task', role })),
  })

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
    onError: (error) => toast.error(getErrorMessage({ error, action: 'update', resource: 'project', role })),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/organizations/${orgId}/projects/${params.projectId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', orgId] })
      toast.success('Project deleted')
      router.push(`/dashboard/${params.orgSlug}/projects`)
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'delete', resource: 'project', role })),
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

  const { data: labels, refetch: refetchLabels } = useQuery({
    queryKey: ['project-labels', orgId, params.projectId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/projects/${params.projectId}/labels`)
        .then((r) => r.data.data as Label[]),
    enabled: !!orgId,
  })

  const { data: orgMembers } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () =>
      api.get(`/organizations/${orgId}/members`, { params: { limit: 100 } })
        .then((r) => r.data.data.items as OrgMember[]),
    enabled: !!orgId,
  })

  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<ProjectRole>('MEMBER')

  const addMemberMutation = useMutation({
    mutationFn: () => api.post(`/organizations/${orgId}/projects/${params.projectId}/members`, { userId: addMemberUserId, role: addMemberRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-members', orgId, params.projectId] })
      setAddMemberUserId('')
      setAddMemberRole('MEMBER')
      toast.success('Member added')
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'add', resource: 'member', role })),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/organizations/${orgId}/projects/${params.projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', orgId, params.projectId] }),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'remove', resource: 'member', role })),
  })

  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#6366f1')

  const createLabelMutation = useMutation({
    mutationFn: () => api.post(`/organizations/${orgId}/projects/${params.projectId}/labels`, { name: labelName.trim(), color: labelColor }),
    onSuccess: () => {
      refetchLabels()
      setLabelName('')
      setLabelColor('#6366f1')
      toast.success('Label created')
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'create', resource: 'label', role })),
  })

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => api.delete(`/organizations/${orgId}/projects/${params.projectId}/labels/${labelId}`),
    onSuccess: () => refetchLabels(),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'delete', resource: 'label', role })),
  })

  const skeletonBadge = <div className="h-5 w-[4.5rem] rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse flex-shrink-0" />

  if (projLoading) return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Loading…"
        backHref={`/dashboard/${params.orgSlug}/projects`}
        titleSuffix={skeletonBadge}
      />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )
  if (projError) return (
    <div className="flex-1 flex flex-col">
      <Header title="Project" backHref={`/dashboard/${params.orgSlug}/projects`} />
      <ErrorState onRetry={refetch} />
    </div>
  )
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
          orgId
            ? <ProjectStatusBadge orgId={orgId} projectId={params.projectId} status={project.status} />
            : skeletonBadge
        }
      />
      <div className="p-6 space-y-6">
        {/* Header card */}
        <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h2>
                {hasOrgRole(role, 'MANAGER') && (
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
                    className="p-1 text-gray-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Edit project"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {hasOrgRole(role, 'MANAGER') && (
                  <button
                    onClick={() => { setDeleteConfirm(''); setShowDelete(true) }}
                    className="p-1 text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {project.description && <p className="text-gray-500 dark:text-zinc-400 text-sm">{project.description}</p>}
              {(project.startDate || project.endDate) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-zinc-500">
                  {project.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Start: {formatDate(project.startDate)}</span>}
                  {project.endDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> End: {formatDate(project.endDate)}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 self-start">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-elevated rounded-lg p-1">
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-white font-medium shadow-sm">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Overview
                </span>
                <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/list`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-white/[0.08] transition-colors">
                  <List className="w-3.5 h-3.5" /> List
                </Link>
                <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/kanban`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-white/[0.08] transition-colors">
                  <LayoutGrid className="w-3.5 h-3.5" /> Kanban
                </Link>
              </div>
              {hasOrgRole(role, 'MEMBER') && (
                <Button onClick={() => setShowCreateTask(true)}>
                  <Plus className="w-3.5 h-3.5" /> New Task
                </Button>
              )}
            </div>
          </div>

          {/* Completion bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-zinc-300 font-medium">Overall Progress</span>
              <span className="text-gray-900 dark:text-white font-bold">{stats.completionPercentage}%</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-zinc-900 to-emerald-500 rounded-full transition-all"
                style={{ width: `${stats.completionPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Tasks', value: stats.totalTasks, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
            { label: 'Completed', value: stats.completedTasks, icon: CheckSquare, color: 'text-green-600 bg-green-50' },
            { label: 'In Progress', value: inProgress, icon: ArrowRight, color: 'text-blue-600 bg-blue-50' },
            { label: 'Overdue', value: stats.overdueTasks, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          ].map((c) => (
            <div key={c.label} className="bg-white dark:bg-surface-card rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 dark:text-zinc-400 text-xs">{c.label}</span>
                <div className={cn('p-1.5 rounded-lg', c.color)}><c.icon className="w-3.5 h-3.5" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Status distribution */}
          <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card p-5">
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
                        <span className="text-gray-600 dark:text-zinc-300">{s.name}</span>
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 dark:text-zinc-500 text-sm">No tasks yet</div>
            )}
          </div>

          {/* Team */}
          <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Team Members</h3>
              <span className="text-xs text-gray-400 dark:text-zinc-500"><Users className="w-3.5 h-3.5 inline mr-1" />{members?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center gap-3 group">
                  <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.user.name}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{member.role}</p>
                  </div>
                  {hasOrgRole(role, 'MANAGER') && (
                    <button
                      onClick={() => removeMemberMutation.mutate(member.userId)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all"
                      title="Remove from project"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {(!members || members.length === 0) && (
                <div className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">No members yet</div>
              )}
            </div>

            {hasOrgRole(role, 'MANAGER') && (() => {
              const memberUserIds = new Set(members?.map((m) => m.userId))
              const available = orgMembers?.filter((m) => !memberUserIds.has(m.userId)) ?? []
              return available.length > 0 ? (
                <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3 mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Add member</p>
                  <SelectDropdown
                    value={addMemberUserId}
                    onChange={setAddMemberUserId}
                    placeholder="Select org member…"
                    options={available.map((m) => ({ label: m.user.name, value: m.userId }))}
                    className="w-full mb-2"
                  />
                  {addMemberUserId && (
                    <div className="flex items-center gap-2">
                      <SelectDropdown
                        value={addMemberRole}
                        onChange={(v) => setAddMemberRole(v as ProjectRole)}
                        options={[
                          { label: 'Lead', value: 'LEAD' },
                          { label: 'Member', value: 'MEMBER' },
                          { label: 'Viewer', value: 'VIEWER' },
                        ]}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => addMemberMutation.mutate()}
                        loading={addMemberMutation.isPending}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    </div>
                  )}
                </div>
              ) : null
            })()}
          </div>

          {/* Labels */}
          <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Labels</h3>
              <span className="text-xs text-gray-400 dark:text-zinc-500"><Tag className="w-3.5 h-3.5 inline mr-1" />{labels?.length ?? 0}</span>
            </div>

            {/* Existing labels */}
            <div className="flex flex-wrap gap-1.5 mb-4 min-h-[28px]">
              {labels?.map((label) => (
                <span key={label.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                  style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}>
                  {label.name}
                  {hasOrgRole(role, 'MEMBER') && (
                    <button onClick={() => deleteLabelMutation.mutate(label.id)}
                      className="ml-0.5 hover:opacity-70 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}
              {(!labels || labels.length === 0) && (
                <p className="text-xs text-gray-400 dark:text-zinc-500">No labels yet</p>
              )}
            </div>

            {/* Create label */}
            {hasOrgRole(role, 'MEMBER') && (
              <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Create label</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={labelName}
                    onChange={(e) => setLabelName(e.target.value)}
                    placeholder="Label name"
                    onKeyDown={(e) => e.key === 'Enter' && labelName.trim() && createLabelMutation.mutate()}
                    className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-white/[0.1] rounded-lg text-xs bg-white dark:bg-surface-elevated dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
                  />
                  <input
                    type="color"
                    value={labelColor}
                    onChange={(e) => setLabelColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/[0.1] cursor-pointer p-0.5 bg-white dark:bg-surface-elevated"
                    title="Pick color"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createLabelMutation.mutate()}
                  loading={createLabelMutation.isPending}
                  disabled={!labelName.trim()}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Label
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Burndown Chart */}
        {burndownData && burndownData.length > 1 && (
          <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Burndown Chart</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={burndownData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: isDark ? '#71717a' : '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => {
                    const [, m, d] = v.split('-')
                    return `${m}/${d}`
                  }}
                  interval={Math.max(0, Math.floor(burndownData.length / 7) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#71717a' : '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    background: isDark ? '#22262F' : '#fff',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                    color: isDark ? '#e4e7ec' : '#111318',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'remaining' ? 'Actual remaining' : 'Ideal',
                  ]}
                  labelFormatter={(label: string) => {
                    const [, m, d] = label.split('-')
                    return `${m}/${d}`
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: isDark ? '#71717a' : '#9ca3af', paddingTop: 12 }}
                  formatter={(v) => v === 'remaining' ? 'Actual remaining' : 'Ideal'}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke={isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'}
                  strokeDasharray="5 3"
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name *</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Start Date</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">End Date</label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
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

      {/* Create Task Modal */}
      <Modal isOpen={showCreateTask} onClose={() => { setShowCreateTask(false); resetTask(); setSelectedTaskLabelIds([]) }} title="New Task">
        <form onSubmit={handleTask((d) => createTaskMutation.mutate(d))} className="px-5 pb-5 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Title *</label>
            <input
              {...regTask('title')}
              placeholder="Task title"
              autoFocus
              className={cn(
                'w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20',
                taskErrors.title ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-white/[0.1]'
              )}
            />
            {taskErrors.title && <p className="text-red-500 text-xs mt-1">{taskErrors.title.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Description</label>
            <textarea
              {...regTask('description')}
              rows={3}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Status</label>
              <SelectDropdown
                value={watchTask('status')}
                onChange={(v) => setTaskVal('status', v as CreateTaskForm['status'])}
                options={[
                  { label: 'Backlog', value: 'BACKLOG' },
                  { label: 'To Do', value: 'TODO' },
                  { label: 'In Progress', value: 'IN_PROGRESS' },
                  { label: 'In Review', value: 'IN_REVIEW' },
                  { label: 'Done', value: 'DONE' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Priority</label>
              <SelectDropdown
                value={watchTask('priority')}
                onChange={(v) => setTaskVal('priority', v as CreateTaskForm['priority'])}
                options={[
                  { label: 'Critical', value: 'CRITICAL' },
                  { label: 'High', value: 'HIGH' },
                  { label: 'Medium', value: 'MEDIUM' },
                  { label: 'Low', value: 'LOW' },
                ]}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Due Date</label>
            <input
              {...regTask('dueDate')}
              type="date"
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
            />
          </div>
          {labels && labels.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const active = selectedTaskLabelIds.includes(l.id)
                  return (
                    <button key={l.id} type="button"
                      onClick={() => setSelectedTaskLabelIds((prev) => active ? prev.filter((id) => id !== l.id) : [...prev, l.id])}
                      className="text-xs px-2.5 py-1 rounded-full font-medium border transition-all"
                      style={active
                        ? { backgroundColor: l.color, color: '#fff', borderColor: l.color }
                        : { backgroundColor: `${l.color}18`, color: l.color, borderColor: `${l.color}40` }
                      }>
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowCreateTask(false); resetTask(); setSelectedTaskLabelIds([]) }}>Cancel</Button>
            <Button type="submit" loading={taskSubmitting || createTaskMutation.isPending}>Create Task</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Modal */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Project">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{project.name}</span> and all its tasks, comments, and attachments. Type the project name to confirm.
          </p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={project.name}
            className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteConfirm !== project.name || deleteMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
