export default function KanbanLoading() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-surface-card border-b border-gray-200 dark:border-white/[0.08] flex-shrink-0" />
      <div className="h-12 bg-white dark:bg-surface-bg border-b border-gray-100 dark:border-white/5 flex-shrink-0" />
      <div className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-4 h-full">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 rounded-xl bg-gray-100 dark:bg-surface-card h-96" />
          ))}
        </div>
      </div>
    </div>
  )
}
