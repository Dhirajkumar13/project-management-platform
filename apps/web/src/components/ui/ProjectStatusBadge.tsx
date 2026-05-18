'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/errors'

type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED'

const STATUS_STYLES: Record<ProjectStatus, string> = {
  ACTIVE:    'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  ARCHIVED:  'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
}

const OPTIONS: { value: ProjectStatus; label: string; dot: string }[] = [
  { value: 'ACTIVE',    label: 'Active',    dot: 'bg-green-500' },
  { value: 'COMPLETED', label: 'Completed', dot: 'bg-blue-500' },
  { value: 'ARCHIVED',  label: 'Archived',  dot: 'bg-gray-400' },
]

interface Props {
  orgId: string
  projectId: string
  status: string
  onUpdate?: () => void
}

export function ProjectStatusBadge({ orgId, projectId, status, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const mutation = useMutation({
    mutationFn: (s: ProjectStatus) =>
      api.patch(`/organizations/${orgId}/projects/${projectId}`, { status: s }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
      toast.success('Project status updated')
      onUpdate?.()
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'update', resource: 'project status' })),
  })

  const current = (status as ProjectStatus) in STATUS_STYLES ? (status as ProjectStatus) : 'ACTIVE'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={mutation.isPending}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
          STATUS_STYLES[current]
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', OPTIONS.find(o => o.value === current)?.dot)} />
        {current}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 z-50 min-w-[150px] overflow-hidden">
          <p className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-widest">Project Status</p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { mutation.mutate(opt.value); setOpen(false) }}
              className="flex items-center justify-between gap-3 w-full px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', opt.dot)} />
                <span className={cn('font-medium', opt.value === current ? 'text-zinc-900' : 'text-gray-700')}>
                  {opt.label}
                </span>
              </span>
              {opt.value === current && <Check className="w-3.5 h-3.5 text-zinc-900" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
