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
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 h-64 animate-pulse" />
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 h-64 animate-pulse" />
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
    { label: 'Total Projects', value: data.totalProjects, icon: FolderOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Tasks', value: data.activeTasks, icon: CheckSquare, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Overdue Tasks', value: data.overdueTasks, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Team Members', value: data.memberCount, icon: Users, color: 'text-green-600 bg-green-50' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title={`${currentOrg?.name} Dashboard`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500 dark:text-slate-400 text-sm">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <DashboardCharts data={data} />

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {data.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No activity yet</div>
            ) : (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={activity.user.name} avatarUrl={activity.user.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="font-medium">{activity.user.name}</span>
                      {' '}{activity.action}
                      {activity.task && <span className="text-indigo-600 dark:text-indigo-400"> &quot;{activity.task.title}&quot;</span>}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatRelativeTime(activity.createdAt)}</p>
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
