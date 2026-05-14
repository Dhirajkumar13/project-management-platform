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
  ChevronDown, Plus, CheckSquare, Search, User
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout: logoutStore } = useAuthStore()
  const { currentOrg, setCurrentOrg } = useOrgStore()
  const [showOrgPicker, setShowOrgPicker] = useState(false)

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
    { href: `/dashboard/${orgSlug}/search`, label: 'Search', icon: Search },
    { href: `/dashboard/${orgSlug}/members`, label: 'Members', icon: Users },
    { href: `/dashboard/${orgSlug}/settings`, label: 'Settings', icon: Settings },
  ]

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    logoutStore()
    router.push('/login')
    toast.success('Logged out')
  }

  return (
    <div className="w-64 bg-slate-900 flex flex-col h-screen flex-shrink-0">
      <div className="p-4 border-b border-slate-800">
        <button
          onClick={() => setShowOrgPicker(!showOrgPicker)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group"
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {currentOrg?.name?.[0] ?? 'P'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-sm font-medium truncate">{currentOrg?.name ?? 'Select org'}</p>
            <p className="text-slate-500 text-xs">Organization</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
        </button>

        {showOrgPicker && (
          <div className="mt-2 bg-slate-800 rounded-lg overflow-hidden">
            {orgsData?.map((org) => (
              <button
                key={org.id}
                onClick={() => { setCurrentOrg(org); setShowOrgPicker(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors',
                  currentOrg?.id === org.id ? 'text-white bg-slate-700' : 'text-slate-300'
                )}
              >
                <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold">
                  {org.name[0]}
                </div>
                <span className="truncate">{org.name}</span>
                {org.role && <span className="ml-auto text-xs text-slate-500">{org.role}</span>}
              </button>
            ))}
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 border-t border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New organization
            </button>
          </div>
        )}
      </div>

      <nav aria-label="Main navigation" className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'sidebar-link',
              pathname === href || pathname.startsWith(href + '/') ? 'active' : ''
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Link href={`/dashboard/${orgSlug}/profile`}
          className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group">
          {user && <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-500 text-xs truncate group-hover:text-slate-400">Profile & Preferences</p>
          </div>
          <User className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  )
}
