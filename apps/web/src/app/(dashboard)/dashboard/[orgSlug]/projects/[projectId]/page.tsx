'use client'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import api from '@/lib/api'
import { Project, Task, ProjectMember, TaskStatus } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, formatDate, formatRelativeTime } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckSquare, AlertTriangle, Users, BarChart2, Calendar, ArrowRight, List } from 'lucide-react'
import Link from 'next/link'

const PIE_COLORS = ['#6b7280', '#3b82f6', '#6366f1', '#8b5cf6', '#22c55e']
const STATUS_ORDER: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export default function ProjectDetailPage({
  params,
}: {
  params: { orgSlug: string; projectId: string }
}) {
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const orgId = currentOrg?.id

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

  if (projLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>
  if (projError) return <div className="flex-1"><Header title="Project" /><ErrorState onRetry={refetch} /></div>
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
      <Header title={project.name} />
      <div className="p-6 space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                  project.status === 'ACTIVE' ? 'text-green-700 bg-green-50' :
                  project.status === 'COMPLETED' ? 'text-blue-700 bg-blue-50' : 'text-gray-600 bg-gray-100'
                )}>{project.status}</span>
              </div>
              {project.description && <p className="text-gray-500 text-sm">{project.description}</p>}
              {(project.startDate || project.endDate) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {project.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Start: {formatDate(project.startDate)}</span>}
                  {project.endDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> End: {formatDate(project.endDate)}</span>}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/list`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <List className="w-4 h-4" /> List View
              </Link>
              <Link href={`/dashboard/${params.orgSlug}/projects/${params.projectId}/kanban`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Kanban <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Completion bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 font-medium">Overall Progress</span>
              <span className="text-gray-900 font-bold">{stats.completionPercentage}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
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
            <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">{c.label}</span>
                <div className={cn('p-1.5 rounded-lg', c.color)}><c.icon className="w-3.5 h-3.5" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Status distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Task Status Distribution</h3>
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
                        <span className="text-gray-600">{s.name}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No tasks yet</div>
            )}
          </div>

          {/* Team */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Team Members</h3>
              <span className="text-xs text-gray-400"><Users className="w-3.5 h-3.5 inline mr-1" />{members?.length ?? 0}</span>
            </div>
            <div className="space-y-3">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.user.name}</p>
                    <p className="text-xs text-gray-400">{member.role}</p>
                  </div>
                </div>
              ))}
              {(!members || members.length === 0) && (
                <div className="text-sm text-gray-400 text-center py-4">No members yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
