export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-14 bg-gray-100 dark:bg-surface-card border-b border-gray-100 dark:border-white/5" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-surface-card border border-gray-100 dark:border-white/[0.06]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56 rounded-xl bg-gray-100 dark:bg-surface-card border border-gray-100 dark:border-white/[0.06]" />
          <div className="h-56 rounded-xl bg-gray-100 dark:bg-surface-card border border-gray-100 dark:border-white/[0.06]" />
        </div>
        <div className="h-48 rounded-xl bg-gray-100 dark:bg-surface-card border border-gray-100 dark:border-white/[0.06]" />
      </div>
    </div>
  )
}
