'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgStore } from '@/store/org.store'
import { useAuthStore } from '@/store/auth.store'
import { Organization } from '@/types'
import api from '@/lib/api'
import { LoadingScreen } from '@/components/ui/Spinner'

export default function DashboardPage() {
  const router = useRouter()
  const { currentOrg, setCurrentOrg } = useOrgStore()
  const user = useAuthStore((s) => s.user)

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => api.get('/organizations').then((r) => r.data.data as Organization[]),
    enabled: !!user,
  })

  useEffect(() => {
    if (orgs && orgs.length > 0) {
      const org = currentOrg && orgs.find((o) => o.id === currentOrg.id) ? currentOrg : orgs[0]
      setCurrentOrg(org)
      router.replace(`/dashboard/${org.slug}`)
    } else if (orgs && orgs.length === 0) {
      router.replace('/dashboard/new-org')
    }
  }, [orgs, currentOrg, router, setCurrentOrg])

  if (isLoading) return <LoadingScreen />
  return <LoadingScreen />
}
