'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/auth.store'
import { useOrgStore } from '@/store/org.store'
import { Organization } from '@/types'
import api from '@/lib/api'
import {
  LayoutDashboard, FolderOpen, Users, Settings, LogOut,
  ChevronDown, Plus, CheckSquare, User, X
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/lib/errors'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout: logoutStore } = useAuthStore()
  const { currentOrg, setCurrentOrg } = useOrgStore()
  const [showOrgPicker, setShowOrgPicker] = useState(false)
  const [showNewOrgModal, setShowNewOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const newOrgInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const createOrgMutation = useMutation({
    mutationFn: (name: string) =>
      api.post('/organizations', { name }).then((r) => r.data.data as Organization),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: ['orgs'] })
      setCurrentOrg(org)
      setShowNewOrgModal(false)
      setNewOrgName('')
      router.push(`/dashboard/${org.slug}`)
      toast.success(`"${org.name}" created`)
    },
    onError: (error) => toast.error(getErrorMessage({ error, action: 'create', resource: 'organization' })),
  })

  useEffect(() => {
    if (showNewOrgModal) setTimeout(() => newOrgInputRef.current?.focus(), 50)
  }, [showNewOrgModal])

  const { data: orgsData } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => api.get('/organizations').then((r) => r.data.data as Organization[]),
    enabled: !!user,
  })

  const orgSlug = currentOrg?.slug || ''

  const navLinks = [
    { href: `/dashboard/${orgSlug}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/dashboard/${orgSlug}/projects`, label: 'Projects', icon: FolderOpen },
    { href: `/dashboard/${orgSlug}/my-work`, label: 'My Work', icon: CheckSquare },
    { href: `/dashboard/${orgSlug}/members`, label: 'Members', icon: Users },
    { href: `/dashboard/${orgSlug}/settings`, label: 'Settings', icon: Settings },
  ]

  // Dashboard is the org root — only match it exactly, not as a prefix of other routes
  const isActive = (href: string) =>
    pathname === href ||
    (href !== `/dashboard/${orgSlug}` && pathname.startsWith(href + '/'))

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    logoutStore()
    router.push('/login')
    toast.success('Logged out')
  }

  return (
    <div className={cn(
      'w-56 bg-surface-nav flex flex-col h-screen flex-shrink-0 transition-transform duration-200 border-r border-white/5',
      'fixed inset-y-0 left-0 z-30 lg:static lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      {/* Org switcher */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between lg:hidden mb-2">
          <span className="text-zinc-100 text-[13px] font-semibold tracking-tight">ProjectFlow</span>
          <button onClick={onClose} aria-label="Close navigation" className="text-zinc-500 hover:text-zinc-100 p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setShowOrgPicker(!showOrgPicker)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.05] transition-colors group"
        >
          <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-zinc-200 text-xs font-bold flex-shrink-0">
            {currentOrg?.name?.[0] ?? 'P'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-zinc-300 text-[13px] font-medium tracking-tight truncate">{currentOrg?.name ?? 'Select org'}</p>
          </div>
          <ChevronDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
        </button>

        {showOrgPicker && (
          <div className="mt-1.5 bg-surface-elevated rounded-lg border border-white/10 overflow-hidden shadow-2xl">
            {orgsData?.map((org) => (
              <button
                key={org.id}
                onClick={() => { setCurrentOrg(org); setShowOrgPicker(false); router.push(`/dashboard/${org.slug}`) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-white/[0.05] transition-colors',
                  currentOrg?.id === org.id ? 'text-zinc-100 bg-white/[0.08]' : 'text-zinc-400'
                )}
              >
                <div className="w-4 h-4 bg-white/10 rounded flex items-center justify-center text-zinc-200 text-[10px] font-bold flex-shrink-0">
                  {org.name[0]}
                </div>
                <span className="truncate">{org.name}</span>
                {org.role && <span className="ml-auto text-[11px] text-zinc-600">{org.role}</span>}
              </button>
            ))}
            <button
              onClick={() => { setShowOrgPicker(false); setShowNewOrgModal(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] border-t border-white/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New organization
            </button>
          </div>
        )}

        {/* New org inline modal */}
        {showNewOrgModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]" onClick={() => setShowNewOrgModal(false)}>
            <div className="bg-surface-elevated border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">New organization</h2>
              <p className="text-xs text-zinc-500 mb-4">Create a separate workspace for a different team or company.</p>
              <input
                ref={newOrgInputRef}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newOrgName.trim().length >= 2) createOrgMutation.mutate(newOrgName.trim())
                  if (e.key === 'Escape') setShowNewOrgModal(false)
                }}
                placeholder="Organization name"
                maxLength={60}
                className="w-full px-3 py-2 rounded-lg bg-surface-card border border-white/[0.1] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowNewOrgModal(false); setNewOrgName('') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createOrgMutation.mutate(newOrgName.trim())}
                  disabled={newOrgName.trim().length < 2 || createOrgMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {createOrgMutation.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav aria-label="Main navigation" className="flex-1 px-2 py-2.5 space-y-px overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn('sidebar-link', isActive(href) ? 'active' : '')}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 py-2.5 border-t border-white/5">
        <Link
          href={`/dashboard/${orgSlug}/profile`}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.05] transition-colors group mb-px"
        >
          {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-zinc-300 text-[13px] font-medium truncate">{user?.name}</p>
            <p className="text-zinc-600 text-[11px] truncate group-hover:text-zinc-500">Profile & Preferences</p>
          </div>
          <User className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-2.5 px-2 py-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] rounded-md text-[13px] font-medium transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  )
}
