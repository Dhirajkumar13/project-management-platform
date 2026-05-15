'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import { Task, Project, TaskComment } from '@/types'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_DOTS, formatRelativeTime } from '@/lib/utils'
import { Search, FileText, FolderOpen, MessageSquare, X } from 'lucide-react'
import Link from 'next/link'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

type SearchType = 'all' | 'task' | 'project' | 'comment'

interface SearchResult {
  tasks: (Task & { project: { id: string; name: string } })[]
  projects: Project[]
  comments: (TaskComment & { task: { id: string; title: string; projectId: string } })[]
}

function highlight(text: string, query: string) {
  if (!query || query.length < 2) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchPage({ params }: { params: { orgSlug: string } }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<SearchType>('all')
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const debouncedQuery = useDebounce(query, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, type, currentOrg?.id],
    queryFn: () =>
      api.get('/search', {
        params: { q: debouncedQuery, orgId: currentOrg?.id, type },
      }).then((r) => r.data.data as SearchResult),
    enabled: debouncedQuery.length >= 2,
  })

  const totalResults = (data?.tasks.length ?? 0) + (data?.projects.length ?? 0) + (data?.comments.length ?? 0)

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Search" />
      <div className="p-6 max-w-3xl">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, comments..."
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'task', 'project', 'comment'] as SearchType[]).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                type === t ? 'bg-zinc-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              )}>
              {t === 'all' ? 'All' : t === 'task' ? 'Tasks' : t === 'project' ? 'Projects' : 'Comments'}
            </button>
          ))}
        </div>

        {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}

        {!isLoading && debouncedQuery.length >= 2 && totalResults === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results for &ldquo;{debouncedQuery}&rdquo;</p>
          </div>
        )}

        {!isLoading && debouncedQuery.length < 2 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        )}

        {data && totalResults > 0 && (
          <div className="space-y-6">
            {(type === 'all' || type === 'task') && data.tasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tasks ({data.tasks.length})
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {data.tasks.map((task, idx) => (
                    <Link key={task.id}
                      href={`/dashboard/${params.orgSlug}/projects/${task.project.id}/kanban`}
                      className={cn('flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors', idx > 0 && 'border-t border-gray-50')}>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {highlight(task.title, debouncedQuery)}
                        </p>
                        <p className="text-xs text-gray-400">{task.project.name}</p>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(type === 'all' || type === 'project') && data.projects.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Projects ({data.projects.length})
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {data.projects.map((project, idx) => (
                    <Link key={project.id}
                      href={`/dashboard/${params.orgSlug}/projects/${project.id}/kanban`}
                      className={cn('flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors', idx > 0 && 'border-t border-gray-50')}>
                      <div className="w-7 h-7 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-4 h-4 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {highlight(project.name, debouncedQuery)}
                        </p>
                        {project.description && (
                          <p className="text-xs text-gray-400 truncate">
                            {highlight(project.description, debouncedQuery)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{project.status}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(type === 'all' || type === 'comment') && data.comments.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Comments ({data.comments.length})
                  </h3>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {data.comments.map((comment, idx) => (
                    <Link key={comment.id}
                      href={`/dashboard/${params.orgSlug}/projects/${comment.task.projectId}/kanban`}
                      className={cn('flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors', idx > 0 && 'border-t border-gray-50')}>
                      <MessageSquare className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {highlight(comment.content, debouncedQuery)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {comment.user.name} on &ldquo;{comment.task.title}&rdquo; · {formatRelativeTime(comment.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
