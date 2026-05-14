'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization } from '@/types'

interface OrgState {
  currentOrg: Organization | null
  setCurrentOrg: (org: Organization) => void
  clearOrg: () => void
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      setCurrentOrg: (org) => set({ currentOrg: org }),
      clearOrg: () => set({ currentOrg: null }),
    }),
    { name: 'org-storage' }
  )
)
