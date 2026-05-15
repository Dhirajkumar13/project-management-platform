export default function ProjectsLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700" />
      <div className="p-6">
        <div className="flex justify-between mb-6">
          <div className="h-9 w-48 rounded-lg bg-gray-100 dark:bg-slate-800" />
          <div className="h-9 w-32 rounded-lg bg-gray-100 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  )
}
