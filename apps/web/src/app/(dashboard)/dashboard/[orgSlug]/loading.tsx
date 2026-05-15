export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-slate-800" />
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  )
}
