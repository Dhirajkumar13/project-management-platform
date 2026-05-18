'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/errors'
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn, formatRelativeTime, hasOrgRole } from '@/lib/utils'

const orgSchema = z.object({ name: z.string().min(2, 'Name must be at least 2 characters') })
type OrgFormData = z.infer<typeof orgSchema>

const webhookSchema = z.object({
  name: z.string().min(1, 'Name required'),
  url: z.string().url('Must be a valid HTTPS URL'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
})
type WebhookFormData = z.infer<typeof webhookSchema>

const ALL_EVENTS = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.updated', label: 'Task Updated' },
  { value: 'task.deleted', label: 'Task Deleted' },
  { value: 'task.moved', label: 'Task Moved' },
  { value: 'comment.created', label: 'Comment Posted' },
  { value: 'project.created', label: 'Project Created' },
  { value: 'project.updated', label: 'Project Updated' },
  { value: 'project.deleted', label: 'Project Deleted' },
  { value: 'member.added', label: 'Member Added' },
  { value: 'member.removed', label: 'Member Removed' },
  { value: 'member.role_changed', label: 'Member Role Changed' },
]

interface Webhook {
  id: string
  name: string
  url: string
  secret: string
  events: string[]
  active: boolean
  createdAt: string
  _count: { deliveries: number }
}

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string; email: string; avatarUrl: string | null }
}

interface WebhookDelivery {
  id: string
  event: string
  statusCode: number | null
  success: boolean
  error: string | null
  createdAt: string
}

function WebhookDeliveriesModal({ webhookId, orgId, onClose }: { webhookId: string; orgId: string; onClose: () => void }) {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => api.get(`/organizations/${orgId}/webhooks/${webhookId}/deliveries`).then(r => r.data.data as WebhookDelivery[]),
  })

  return (
    <Modal isOpen title="Delivery History" onClose={onClose} size="lg">
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : !deliveries?.length ? (
          <p className="text-center text-gray-400 py-8">No deliveries yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 text-sm">
                {d.success
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{d.event}</span>
                {d.statusCode && <span className={cn('text-xs font-medium', d.success ? 'text-green-600' : 'text-red-600')}>{d.statusCode}</span>}
                {d.error && <span className="text-xs text-red-500 truncate flex-1">{d.error}</span>}
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(d.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function OrgSettingsPage() {
  const { currentOrg, setCurrentOrg, clearOrg } = useOrgStore()
  const qc = useQueryClient()
  const router = useRouter()
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [deliveriesWebhookId, setDeliveriesWebhookId] = useState<string | null>(null)
  const [auditPage, setAuditPage] = useState(1)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const AUDIT_LIMIT = 20

  const { register: registerOrg, handleSubmit: handleOrgSubmit, formState: { errors: orgErrors, isSubmitting: orgSubmitting } } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    values: { name: currentOrg?.name ?? '' },
  })

  const { register: registerWebhook, handleSubmit: handleWebhookSubmit, reset: resetWebhook, watch, setValue, formState: { errors: whErrors, isSubmitting: whSubmitting } } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { events: [] },
  })

  const selectedEvents = watch('events') ?? []

  const updateMutation = useMutation({
    mutationFn: (data: OrgFormData) => api.patch(`/organizations/${currentOrg!.id}`, data),
    onSuccess: (res) => { setCurrentOrg({ ...currentOrg!, name: res.data.data.name }); toast.success('Organization updated!') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'update', resource: 'organization', role: currentOrg?.role })),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/organizations/${currentOrg!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgs'] })
      clearOrg()
      toast.success('Organization deleted')
      router.push('/dashboard')
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'delete', resource: 'organization', role: currentOrg?.role })),
  })

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks', currentOrg?.id],
    queryFn: () => api.get(`/organizations/${currentOrg!.id}/webhooks`).then(r => r.data.data as Webhook[]),
    enabled: !!currentOrg?.id,
  })

  const { data: auditData } = useQuery({
    queryKey: ['audit-log', currentOrg?.id, auditPage],
    queryFn: () => api.get(`/organizations/${currentOrg!.id}/audit-log`, { params: { page: auditPage, limit: AUDIT_LIMIT } })
      .then(r => r.data as { data: { items: AuditEntry[]; total: number } }),
    enabled: !!currentOrg?.id,
  })

  const createWebhookMutation = useMutation({
    mutationFn: (data: WebhookFormData) => api.post(`/organizations/${currentOrg!.id}/webhooks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', currentOrg?.id] })
      setShowWebhookModal(false)
      resetWebhook()
      toast.success('Webhook created!')
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'create', resource: 'webhook', role: currentOrg?.role })),
  })

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${currentOrg!.id}/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks', currentOrg?.id] }); toast.success('Webhook deleted') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'delete', resource: 'webhook', role: currentOrg?.role })),
  })

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/organizations/${currentOrg!.id}/webhooks/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', currentOrg?.id] }),
    onError: (error) => toast.error(getErrorMessage({ error, action: 'update', resource: 'webhook', role: currentOrg?.role })),
  })

  const rotateSecretMutation = useMutation({
    mutationFn: (id: string) => api.post(`/organizations/${currentOrg!.id}/webhooks/${id}/rotate-secret`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks', currentOrg?.id] }); toast.success('Secret rotated') },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'rotate', resource: 'webhook secret', role: currentOrg?.role })),
  })

  const toggleEvent = (event: string) => {
    const current = selectedEvents
    setValue('events', current.includes(event) ? current.filter(e => e !== event) : [...current, event])
  }

  const auditItems = auditData?.data.items ?? []
  const auditTotal = auditData?.data.total ?? 0
  const auditPages = Math.ceil(auditTotal / AUDIT_LIMIT)

  const actionIcon = (action: string) => {
    if (action.includes('created') || action.includes('added')) return '+'
    if (action.includes('deleted') || action.includes('removed')) return '−'
    return '~'
  }

  const actionColor = (action: string) => {
    if (action.includes('created') || action.includes('added')) return 'bg-green-100 text-green-700'
    if (action.includes('deleted') || action.includes('removed')) return 'bg-red-100 text-red-700'
    return 'bg-blue-100 text-blue-700'
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Organization Settings" />
      <div className="p-6 max-w-3xl space-y-6">

        {/* General */}
        <div className="bg-white dark:bg-surface-card rounded-xl shadow-sm border border-gray-100 dark:border-white/[0.08] p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h2>
          <form onSubmit={handleOrgSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Organization Name</label>
              <input {...registerOrg('name')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:bg-surface-elevated dark:text-white" />
              {orgErrors.name && <p className="text-red-500 text-xs mt-1">{orgErrors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Slug</label>
              <input value={currentOrg?.slug ?? ''} disabled
                className="w-full px-3 py-2 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm bg-gray-50 dark:bg-surface-elevated text-gray-500" />
              <p className="text-xs text-gray-400 mt-1">Slug cannot be changed after creation</p>
            </div>
            {hasOrgRole(currentOrg?.role, 'ADMIN') ? (
              <Button type="submit" loading={orgSubmitting || updateMutation.isPending}>Save Changes</Button>
            ) : (
              <p className="text-xs text-gray-400 dark:text-zinc-500">Only Admins and above can rename the organization.</p>
            )}
          </form>
        </div>

        {/* Webhooks */}
        <div className="bg-white dark:bg-surface-card rounded-xl shadow-sm border border-gray-100 dark:border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Receive HTTP POST notifications when events occur in your organization.</p>
            </div>
            <Button onClick={() => setShowWebhookModal(true)} size="sm">
              <Plus className="w-4 h-4" /> Add Webhook
            </Button>
          </div>

          {!webhooks?.length ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-white/[0.08] rounded-xl py-10 text-center">
              <p className="text-gray-400 text-sm">No webhooks configured yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="border border-gray-100 dark:border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{wh.name}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', wh.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {wh.active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono truncate">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {wh.events.map(e => (
                          <span key={e} className="text-xs bg-zinc-100 dark:bg-surface-card text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">{e}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setDeliveriesWebhookId(wh.id)}
                        title="View delivery history"
                        className="p-1.5 text-gray-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors text-xs">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm('Rotate the signing secret? This will invalidate the current secret.')) rotateSecretMutation.mutate(wh.id) }}
                        title="Rotate secret"
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleWebhookMutation.mutate({ id: wh.id, active: !wh.active })}
                        className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-surface-elevated transition-colors">
                        {wh.active ? 'Pause' : 'Enable'}
                      </button>
                      <button onClick={() => { if (confirm('Delete this webhook?')) deleteWebhookMutation.mutate(wh.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 dark:border-white/[0.08]/50 flex items-center gap-2">
                    <span className="text-xs text-gray-400">Signing secret:</span>
                    <code className="text-xs font-mono text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-surface-elevated px-2 py-0.5 rounded select-all">{wh.secret}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Log */}
        <div className="bg-white dark:bg-surface-card rounded-xl shadow-sm border border-gray-100 dark:border-white/[0.08] p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Log</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">A record of all significant actions taken within your organization.</p>
          </div>

          {!auditItems.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">No audit events recorded yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {auditItems.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-white/[0.08]/50 last:border-0">
                    <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5', actionColor(entry.action))}>
                      {actionIcon(entry.action)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.user.name}</span>
                        <span className="text-sm text-gray-600 dark:text-zinc-300">{entry.action.replace(/\./g, ' ')}</span>
                        <span className="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-surface-elevated px-1.5 py-0.5 rounded">{entry.entityType}:{entry.entityId.slice(0, 8)}</span>
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{JSON.stringify(entry.metadata)}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0">{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
              {auditPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.08]">
                  <p className="text-xs text-gray-500">{auditTotal} total events</p>
                  <div className="flex items-center gap-2">
                    <button disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-gray-500">{auditPage} / {auditPages}</span>
                    <button disabled={auditPage === auditPages} onClick={() => setAuditPage(p => p + 1)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Danger Zone — OWNER only */}
        {currentOrg?.role === 'OWNER' && (
          <div className="bg-white dark:bg-surface-card rounded-xl shadow-sm border border-red-200 dark:border-red-900/40 p-6">
            <h2 className="text-base font-semibold text-red-600 mb-1">Danger Zone</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              Permanently deletes this organization including all projects, tasks, members, and data. This cannot be undone.
            </p>
            <Button variant="danger" onClick={() => { setDeleteConfirmName(''); setShowDeleteModal(true) }}>
              <Trash2 className="w-4 h-4" />
              Delete Organization
            </Button>
          </div>
        )}
      </div>

      {/* Create Webhook Modal */}
      <Modal isOpen={showWebhookModal} onClose={() => { setShowWebhookModal(false); resetWebhook() }} title="Add Webhook" size="lg">
        <form onSubmit={handleWebhookSubmit((d) => createWebhookMutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name *</label>
            <input {...registerWebhook('name')} placeholder="e.g. Slack notifications"
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:bg-surface-elevated dark:text-white" />
            {whErrors.name && <p className="text-red-500 text-xs mt-1">{whErrors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Endpoint URL *</label>
            <input {...registerWebhook('url')} placeholder="https://your-server.com/webhook"
              className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:bg-surface-elevated dark:text-white" />
            {whErrors.url && <p className="text-red-500 text-xs mt-1">{whErrors.url.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Events to subscribe *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_EVENTS.map((e) => (
                <label key={e.value} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={selectedEvents.includes(e.value)} onChange={() => toggleEvent(e.value)}
                    className="rounded border-gray-300 text-zinc-900 focus:ring-zinc-900" />
                  <span className="text-sm text-gray-700 dark:text-zinc-300 group-hover:text-zinc-900 transition-colors">{e.label}</span>
                </label>
              ))}
            </div>
            {whErrors.events && <p className="text-red-500 text-xs mt-1">{whErrors.events.message}</p>}
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-surface-elevated rounded-lg p-3">
            A unique HMAC-SHA256 signing secret will be generated automatically. Use it to verify incoming requests by checking the <code className="font-mono">X-ProjectFlow-Signature</code> header.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowWebhookModal(false); resetWebhook() }}>Cancel</Button>
            <Button type="submit" loading={whSubmitting || createWebhookMutation.isPending}>Create Webhook</Button>
          </div>
        </form>
      </Modal>

      {deliveriesWebhookId && (
        <WebhookDeliveriesModal
          webhookId={deliveriesWebhookId}
          orgId={currentOrg!.id}
          onClose={() => setDeliveriesWebhookId(null)}
        />
      )}

      {/* Delete org confirmation modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Organization">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{currentOrg?.name}</span> and all its data. Type the organization name to confirm.
          </p>
          <input
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={currentOrg?.name}
            className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-surface-elevated dark:text-white"
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteConfirmName !== currentOrg?.name || deleteMutation.isPending}
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
