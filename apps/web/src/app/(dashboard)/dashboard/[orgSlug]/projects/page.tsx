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
import { formatDate, STATUS_COLORS, cn } from '@/lib/utils'
import { Plus, FolderOpen, Calendar, Users, BarChart2, Search } from 'lucide-react'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50',
  ARCHIVED: 'text-gray-600 bg-gray-100',
  COMPLETED: 'text-blue-700 bg-blue-50',
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
    <Link href={`/dashboard/${orgSlug}/projects/${project.id}/kanban`}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all block">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
          {project.description && (
            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full font-medium ml-3 flex-shrink-0', PROJECT_STATUS_COLORS[project.status])}>
          {project.status}
        </span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          {project.stats?.totalTasks ?? project._count?.tasks ?? 0} tasks
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {project._count?.members ?? 0} members
        </span>
        {project.endDate && (
          <span className="flex items-center gap-1">
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
    ? rawData?.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
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
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by name or description..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              ×
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['', 'ACTIVE', 'ARCHIVED', 'COMPLETED'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s as ProjectStatus | '')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                )}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : data?.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No projects yet</h3>
            <p className="text-gray-400 text-sm mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.map((project) => (
              <ProjectCard key={project.id} project={project} orgSlug={params.orgSlug} />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); reset() }} title="Create Project">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input {...register('name')} placeholder="Project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} rows={3} placeholder="What is this project about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input {...register('startDate')} type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input {...register('endDate')} type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
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
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => { setShowCreate(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
