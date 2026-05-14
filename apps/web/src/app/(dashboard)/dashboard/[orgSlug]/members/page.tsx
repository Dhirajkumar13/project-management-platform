'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import api from '@/lib/api'
import { OrgMember, OrgRole } from '@/types'
import { cn, ROLE_COLORS, formatDate } from '@/lib/utils'
import { Plus, Trash2, Mail } from 'lucide-react'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']).default('MEMBER'),
})
type InviteForm = z.infer<typeof inviteSchema>

export default function MembersPage({ params }: { params: { orgSlug: string } }) {
  const [showInvite, setShowInvite] = useState(false)
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const qc = useQueryClient()

  const { data: membersData, isLoading, isError, refetch } = useQuery({
    queryKey: ['members', currentOrg?.id],
    queryFn: () =>
      api.get(`/organizations/${currentOrg!.id}/members`).then((r) => r.data.data.items as OrgMember[]),
    enabled: !!currentOrg?.id,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => api.post(`/organizations/${currentOrg!.id}/invites`, data),
    onSuccess: () => {
      setShowInvite(false)
      reset()
      toast.success('Invite sent!')
    },
    onError: () => toast.error('Failed to send invite'),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/organizations/${currentOrg!.id}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', currentOrg?.id] })
      toast.success('Member removed')
    },
    onError: () => toast.error('Failed to remove member'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      api.patch(`/organizations/${currentOrg!.id}/members/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', currentOrg?.id] })
      toast.success('Role updated')
    },
    onError: () => toast.error('Failed to update role'),
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Team Members" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-500 text-sm">{membersData?.length ?? 0} members</p>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="w-4 h-4" />
            Invite Member
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center"><Spinner /></td></tr>
              ) : isError ? (
                <tr><td colSpan={4}><ErrorState onRetry={refetch} /></td></tr>
              ) : membersData?.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                        <p className="text-xs text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {member.role === 'OWNER' ? (
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium', ROLE_COLORS[member.role])}>
                        {member.role}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => updateRoleMutation.mutate({ userId: member.userId, role: e.target.value as OrgRole })}
                        className={cn('text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500', ROLE_COLORS[member.role])}
                      >
                        {(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as OrgRole[]).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(member.joinedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    {member.role !== 'OWNER' && (
                      <button
                        onClick={() => { if (confirm('Remove this member?')) removeMutation.mutate(member.userId) }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showInvite} onClose={() => { setShowInvite(false); reset() }} title="Invite Team Member">
        <form onSubmit={handleSubmit((d) => inviteMutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('email')} type="email" placeholder="colleague@company.com"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select {...register('role')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="VIEWER">Viewer — read only</option>
              <option value="MEMBER">Member — can create & edit</option>
              <option value="MANAGER">Manager — can manage members</option>
              <option value="ADMIN">Admin — full control except billing</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => { setShowInvite(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || inviteMutation.isPending}>Send Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
