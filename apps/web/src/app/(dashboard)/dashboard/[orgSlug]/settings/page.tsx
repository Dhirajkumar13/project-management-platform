'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import toast from 'react-hot-toast'

const schema = z.object({ name: z.string().min(2, 'Name must be at least 2 characters') })
type FormData = z.infer<typeof schema>

export default function OrgSettingsPage() {
  const { currentOrg, setCurrentOrg } = useOrgStore()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: { name: currentOrg?.name ?? '' },
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => api.patch(`/organizations/${currentOrg!.id}`, data),
    onSuccess: (res) => {
      setCurrentOrg({ ...currentOrg!, name: res.data.data.name })
      toast.success('Organization updated!')
    },
    onError: () => toast.error('Failed to update organization'),
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Organization Settings" />
      <div className="p-6 max-w-2xl space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input value={currentOrg?.slug ?? ''} disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
              <p className="text-xs text-gray-400 mt-1">Slug cannot be changed after creation</p>
            </div>
            <Button type="submit" loading={isSubmitting || updateMutation.isPending}>Save Changes</Button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Plan</span>
              <span className="text-indigo-600 font-medium">Pro</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Seats</span>
              <span>10 / 10 used</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Next billing</span>
              <span>June 1, 2026</span>
            </div>
          </div>
          <Button variant="outline" className="mt-4">Manage Billing</Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h2>
          <p className="text-gray-500 text-sm mb-4">
            Deleting your organization will permanently remove all projects, tasks, and members.
            This action cannot be undone.
          </p>
          <Button variant="danger" onClick={() => toast.error('Contact support to delete your organization')}>
            Delete Organization
          </Button>
        </div>
      </div>
    </div>
  )
}
