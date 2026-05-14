'use client'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { STATUS_LABELS } from '@/lib/utils'
import { DashboardStats } from '@/types'

const STATUS_CHART_COLORS = ['#6b7280', '#3b82f6', '#6366f1', '#8b5cf6', '#22c55e']

interface Props {
  data: DashboardStats
}

export function DashboardCharts({ data }: Props) {
  const pieData = data.tasksByStatus.map((s, i) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length],
  }))

  const barData = data.teamWorkload.map((w) => ({
    name: w.user.name.split(' ')[0],
    assigned: w.assignedCount,
    completed: w.completedCount,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Tasks by Status</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No task data yet</div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Team Workload</h3>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="assigned" fill="#6366f1" radius={[4, 4, 0, 0]} name="Assigned" />
              <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No workload data</div>
        )}
      </div>
    </div>
  )
}
