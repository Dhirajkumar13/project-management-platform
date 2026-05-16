'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import api from '@/lib/api'
import { Project, ProjectStatus } from '@/types'
import { formatDate, cn, hasOrgRole } from '@/lib/utils'
import { Plus, FolderOpen, Calendar, Users, BarChart2, Search } from 'lucide-react'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PROJECT_STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
  ARCHIVED:  'text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/[0.06]',
  COMPLETED: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).default('ACTIVE'),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).default('PRIVATE'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function ProjectCard({ project, orgSlug }: { project: Project; orgSlug: string }) {
  const pct = project.stats?.completionPercentage ?? 0
  return (
    <Link
      href={`/dashboard/${orgSlug}/projects/${project.id}/kanban`}
      className="group bg-white dark:bg-surface-card rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.12] shadow-card hover:shadow-card-md transition-all block"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0', PROJECT_STATUS_STYLES[project.status])}>
          {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[11px] text-gray-400 dark:text-zinc-500 mb-1.5">
          <span>Progress</span>
          <span className="font-medium text-gray-600 dark:text-zinc-400">{pct}%</span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-800 dark:bg-zinc-300 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          {project.stats?.totalTasks ?? project._count?.tasks ?? 0} tasks
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {project._count?.members ?? 0}
        </span>
        {project.endDate && (
          <span className="flex items-center gap-1 ml-auto">
            <Calendar className="w-3 h-3" />
            {formatDate(project.endDate)}
          </span>
        )}
      </div>
    </Link>
  )
}

export default function ProjectsPage({ params }: { params: { orgSlug: string } }) {
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const qc = useQueryClient()

  const { data: rawData, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', currentOrg?.id, statusFilter],
    queryFn: () =>
      api.get(`/organizations/${currentOrg!.id}/projects`, {
        params: { status: statusFilter || undefined, limit: 50 },
      }).then((r) => r.data.data.items as Project[]),
    enabled: !!currentOrg?.id,
  })

  const data = searchQuery.trim()
    ? rawData?.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rawData

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const createMutation = useMutation({
    mutationFn: (d: FormData) => api.post(`/organizations/${currentOrg!.id}/projects`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowCreate(false)
      reset()
      toast.success('Project created!')
    },
    onError: () => toast.error('Failed to create project'),
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Projects" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
            />
          </div>

          <div className="flex gap-1.5">
            {(['', 'ACTIVE', 'ARCHIVED', 'COMPLETED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s as ProjectStatus | '')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-white dark:bg-surface-card text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-surface-elevated'
                )}
              >
                {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All'}
              </button>
            ))}
          </div>

          {hasOrgRole(currentOrg?.role, 'MEMBER') && (
            <Button className="ml-auto" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" />
              New Project
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : data?.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-600 dark:text-zinc-300 mb-1">No projects yet</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" />Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.map((project) => (
              <ProjectCard key={project.id} project={project} orgSlug={params.orgSlug} />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); reset() }} title="Create Project">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-5 pb-5 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Name *</label>
            <input
              {...register('name')}
              placeholder="Project name"
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="What is this project about?"
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Start Date</label>
              <input
                {...register('startDate')}
                type="date"
                className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">End Date</label>
              <input
                {...register('endDate')}
                type="date"
                className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.1] rounded-lg text-sm bg-white dark:bg-surface-card dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Status</label>
              <SelectDropdown
                value={watch('status') ?? 'ACTIVE'}
                onChange={(v) => setValue('status', v as FormData['status'])}
                options={[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Archived', value: 'ARCHIVED' },
                  { label: 'Completed', value: 'COMPLETED' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Visibility</label>
              <SelectDropdown
                value={watch('visibility') ?? 'PRIVATE'}
                onChange={(v) => setValue('visibility', v as FormData['visibility'])}
                options={[
                  { label: 'Private', value: 'PRIVATE' },
                  { label: 'Public', value: 'PUBLIC' },
                ]}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowCreate(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
