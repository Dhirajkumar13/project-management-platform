export default function ListLoading() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700" />
      <div className="p-6">
        <div className="h-10 w-64 rounded-lg bg-gray-100 dark:bg-slate-800 mb-4" />
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="h-11 bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 border-b border-gray-50 dark:border-slate-700/50 px-4 flex items-center gap-4">
              <div className="w-4 h-4 rounded bg-gray-200 dark:bg-slate-600" />
              <div className="flex-1 h-4 rounded bg-gray-200 dark:bg-slate-600" />
              <div className="w-20 h-5 rounded-full bg-gray-200 dark:bg-slate-600" />
              <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-slate-600" />
              <div className="w-20 h-4 rounded bg-gray-200 dark:bg-slate-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
