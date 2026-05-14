'use client'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useOrgStore } from '@/store/org.store'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { setCurrentOrg } = useOrgStore()

  useEffect(() => {
    if (!user) router.push(`/login?redirect=/invite/${params.token}`)
  }, [user, params.token, router])

  const mutation = useMutation({
    mutationFn: () => api.post(`/organizations/invites/${params.token}/accept`),
    onSuccess: (res) => {
      const org = res.data.data?.organization
      if (org) setCurrentOrg(org)
      toast.success('Welcome! You have joined the organization.')
      router.push('/dashboard')
    },
    onError: () => toast.error('Invite is invalid or has expired'),
  })

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">P</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;ve been invited</h1>
        <p className="text-gray-500 text-sm mb-6">Click below to join the organization.</p>
        <Button className="w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Accept Invitation
        </Button>
        <button onClick={() => router.push('/dashboard')}
          className="mt-3 text-sm text-gray-400 hover:text-gray-600 w-full">
          Decline
        </button>
      </div>
    </div>
  )
}
