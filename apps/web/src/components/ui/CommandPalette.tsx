'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useParams } from 'next/navigation'
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_DOTS, formatRelativeTime } from '@/lib/utils'
import { Search, FileText, FolderOpen, MessageSquare, X, Clock } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { Task, Project, TaskComment } from '@/types'

type SearchType = 'all' | 'task' | 'project' | 'comment'

interface SearchResult {
  tasks: (Task & { project: { id: string; name: string } })[]
  projects: Project[]
  comments: (TaskComment & { task: { id: string; title: string; projectId: string } })[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function highlight(text: string, query: string) {
  if (!query || query.length < 2) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const RECENT_KEY = 'cmd-palette-recent'
const MAX_RECENT = 5

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function saveRecent(query: string) {
  const prev = getRecent().filter((q) => q !== query)
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)))
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<SearchType>('all')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = params?.orgSlug ?? ''
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setType('all')
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { data, isLoading } = useQuery({
    queryKey: ['cmd-search', debouncedQuery, type, currentOrg?.id],
    queryFn: () =>
      api.get('/search', {
        params: { q: debouncedQuery, orgId: currentOrg?.id, type },
      }).then((r) => r.data.data as SearchResult),
    enabled: debouncedQuery.length >= 2 && !!currentOrg?.id,
  })

  const handleSelect = useCallback((q: string) => {
    if (q.trim().length >= 2) {
      saveRecent(q.trim())
    }
    onClose()
  }, [onClose])

  const useRecent = (q: string) => {
    setQuery(q)
    inputRef.current?.focus()
  }

  const totalResults = (data?.tasks.length ?? 0) + (data?.projects.length ?? 0) + (data?.comments.length ?? 0)
  const showEmpty = !isLoading && debouncedQuery.length >= 2 && totalResults === 0
  const showPrompt = debouncedQuery.length < 2

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && debouncedQuery.length >= 2) handleSelect(debouncedQuery)
            }}
            placeholder="Search tasks, projects, comments..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded border border-gray-200 font-mono">
              esc
            </kbd>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
          {(['all', 'task', 'project', 'comment'] as SearchType[]).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors',
                type === t ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              )}>
              {t === 'all' ? 'All' : t === 'task' ? 'Tasks' : t === 'project' ? 'Projects' : 'Comments'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Recent searches */}
          {showPrompt && recentSearches.length > 0 && (
            <div className="p-3">
              <p className="px-2 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recent
              </p>
              {recentSearches.map((q) => (
                <button key={q} onClick={() => useRecent(q)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <Clock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          )}

          {showPrompt && recentSearches.length === 0 && (
            <div className="py-10 text-center text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
              <p className="text-xs mt-1 text-gray-300">Tasks · Projects · Comments</p>
            </div>
          )}

          {isLoading && (
            <div className="py-8 text-center text-gray-400 text-sm">Searching...</div>
          )}

          {showEmpty && (
            <div className="py-10 text-center text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No results for &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          )}

          {data && totalResults > 0 && (
            <div className="p-2 space-y-1">
              {/* Tasks */}
              {(type === 'all' || type === 'task') && data.tasks.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <FileText className="w-3 h-3" /> Tasks ({data.tasks.length})
                  </p>
                  {data.tasks.map((task) => (
                    <Link key={task.id}
                      href={`/dashboard/${orgSlug}/projects/${task.project.id}/kanban`}
                      onClick={() => handleSelect(debouncedQuery)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
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
              )}

              {/* Projects */}
              {(type === 'all' || type === 'project') && data.projects.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <FolderOpen className="w-3 h-3" /> Projects ({data.projects.length})
                  </p>
                  {data.projects.map((project) => (
                    <Link key={project.id}
                      href={`/dashboard/${orgSlug}/projects/${project.id}/kanban`}
                      onClick={() => handleSelect(debouncedQuery)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-4 h-4 text-indigo-500" />
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
              )}

              {/* Comments */}
              {(type === 'all' || type === 'comment') && data.comments.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <MessageSquare className="w-3 h-3" /> Comments ({data.comments.length})
                  </p>
                  {data.comments.map((comment) => (
                    <Link key={comment.id}
                      href={`/dashboard/${orgSlug}/projects/${comment.task.projectId}/kanban`}
                      onClick={() => handleSelect(debouncedQuery)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <MessageSquare className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {highlight(comment.content, debouncedQuery)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {comment.user.name} · &ldquo;{comment.task.title}&rdquo; · {formatRelativeTime(comment.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
