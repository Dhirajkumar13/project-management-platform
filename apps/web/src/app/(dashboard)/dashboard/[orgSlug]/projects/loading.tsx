export default function ProjectsLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-12 bg-gray-100 dark:bg-surface-card border-b border-gray-100 dark:border-white/5" />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-48 rounded-lg bg-gray-100 dark:bg-surface-card" />
          <div className="h-9 w-72 rounded-lg bg-gray-100 dark:bg-surface-card" />
          <div className="ml-auto h-9 w-28 rounded-lg bg-gray-100 dark:bg-surface-card" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-gray-100 dark:bg-surface-card border border-gray-100 dark:border-white/[0.06]" />
          ))}
        </div>
      </div>
    </div>
  )
}
