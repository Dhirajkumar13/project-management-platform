'use client'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Avatar } from '@/components/ui/Avatar'
import api from '@/lib/api'
import { DashboardStats } from '@/types'
import { FolderOpen, CheckSquare, AlertTriangle, Users } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

const DashboardCharts = dynamic(
  () => import('@/components/dashboard/DashboardCharts').then((m) => ({ default: m.DashboardCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] h-56 animate-pulse" />
        <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] h-56 animate-pulse" />
      </div>
    ),
  }
)

export default function OrgDashboardPage({ params }: { params: { orgSlug: string } }) {
  const currentOrg = useOrgStore((s) => s.currentOrg)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', currentOrg?.id],
    queryFn: () =>
      api.get(`/dashboard/${currentOrg!.id}`).then((r) => r.data.data as DashboardStats),
    enabled: !!currentOrg?.id,
  })

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>
  if (isError) return <div className="flex-1"><Header title="Dashboard" /><ErrorState onRetry={refetch} /></div>
  if (!data) return null

  const statCards = [
    { label: 'Total Projects', value: data.totalProjects, icon: FolderOpen, iconCls: 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.06]' },
    { label: 'Active Tasks',   value: data.activeTasks,   icon: CheckSquare, iconCls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Overdue Tasks',  value: data.overdueTasks,  icon: AlertTriangle, iconCls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' },
    { label: 'Team Members',   value: data.memberCount,   icon: Users, iconCls: 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.06]' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title={`${currentOrg?.name}`} subtitle="Overview" />
      <div className="p-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-surface-card rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] shadow-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500 dark:text-zinc-400 text-xs font-medium">{card.label}</span>
                <div className={`p-1.5 rounded-lg ${card.iconCls}`}>
                  <card.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight">{card.value}</p>
            </div>
          ))}
        </div>

        <DashboardCharts data={data} />

        {/* Recent Activity */}
        <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.06] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {data.recentActivity.length === 0 ? (
              <div className="py-10 text-center text-gray-400 dark:text-zinc-500 text-sm">No activity yet</div>
            ) : (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <Avatar name={activity.user.name} avatarUrl={activity.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                      <span className="font-medium text-gray-900 dark:text-zinc-100">{activity.user.name}</span>
                      {' '}{activity.action}
                      {activity.task && <span className="text-gray-900 dark:text-zinc-200 font-medium"> &quot;{activity.task.title}&quot;</span>}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{formatRelativeTime(activity.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
