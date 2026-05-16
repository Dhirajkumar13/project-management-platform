export default function ListLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-14 bg-gray-100 dark:bg-surface-card border-b border-gray-200 dark:border-white/[0.08]" />
      <div className="p-6">
        <div className="h-10 w-64 rounded-lg bg-gray-100 dark:bg-surface-card mb-4" />
        <div className="bg-white dark:bg-surface-card rounded-xl border border-gray-100 dark:border-white/[0.08] overflow-hidden">
          <div className="h-11 bg-gray-50 dark:bg-surface-elevated border-b border-gray-100 dark:border-white/[0.1]" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 border-b border-gray-50 dark:border-white/[0.08]/50 px-4 flex items-center gap-4">
              <div className="w-4 h-4 rounded bg-gray-200 dark:bg-zinc-600" />
              <div className="flex-1 h-4 rounded bg-gray-200 dark:bg-zinc-600" />
              <div className="w-20 h-5 rounded-full bg-gray-200 dark:bg-zinc-600" />
              <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-zinc-600" />
              <div className="w-20 h-4 rounded bg-gray-200 dark:bg-zinc-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
