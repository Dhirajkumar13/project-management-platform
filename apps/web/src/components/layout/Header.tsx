'use client'
import { useState, useEffect } from 'react'
import { Bell, ArrowLeft, Search, Sun, Moon, Monitor } from 'lucide-react'
import { useNotificationStore } from '@/store/notification.store'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Notification } from '@/types'
import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useThemeStore, resolveTheme } from '@/store/theme.store'

export function Header({ title, subtitle, backHref, titleSuffix }: {
  title?: string
  subtitle?: string
  backHref?: string
  titleSuffix?: React.ReactNode
}) {
  const router = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const { preference, setPreference } = useThemeStore()
  const resolved = resolveTheme(preference)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const { unreadCount, notifications, markRead, markAllRead, clearNotifications, setNotifications, setUnreadCount } = useNotificationStore()

  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications?limit=20'),
        api.get('/notifications/count'),
      ])
      setNotifications(notifRes.data.data.items)
      setUnreadCount(countRes.data.data.count)
      return notifRes.data.data.items as Notification[]
    },
    refetchInterval: 30000,
  })

  const handleMarkAllRead = async () => {
    await api.post('/notifications/read-all')
    markAllRead()
  }

  const handleClearAll = async () => {
    await api.delete('/notifications')
    clearNotifications()
  }

  const handleMarkRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`)
    markRead(id)
  }

  return (
    <header className="h-12 bg-white dark:bg-surface-bg border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-5 flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {backHref && (
          <button
            onClick={() => router.back()}
            className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-md transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{title}</h1>
            {titleSuffix}
          </div>
          {subtitle && <p className="text-[11px] text-gray-400 dark:text-zinc-500 -mt-px">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={() => setShowPalette(true)}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-surface-card hover:bg-gray-100 dark:hover:bg-surface-elevated border border-gray-200 dark:border-white/[0.07] rounded-lg transition-colors"
          aria-label="Open search (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs text-gray-400 dark:text-zinc-500">Search</span>
          <kbd className="ml-1 text-[10px] font-mono bg-white dark:bg-surface-elevated border border-gray-200 dark:border-white/10 rounded px-1 py-0.5 text-gray-400 dark:text-zinc-500">⌘K</kbd>
        </button>

        <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />

        {/* Theme toggle */}
        <div
          role="group"
          aria-label="Theme preference"
          className="hidden sm:flex items-center bg-gray-100 dark:bg-surface-card rounded-lg p-0.5 gap-px border border-gray-200 dark:border-white/[0.07]"
        >
          {([
            { value: 'light',  icon: Sun,     label: 'Light mode' },
            { value: 'dark',   icon: Moon,    label: 'Dark mode' },
            { value: 'system', icon: Monitor, label: `System (${resolved})` },
          ] as const).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setPreference(value)}
              aria-pressed={preference === value}
              aria-label={label}
              title={label}
              className={cn(
                'p-1.5 rounded-md transition-all',
                preference === value
                  ? 'bg-white dark:bg-surface-elevated text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
            aria-expanded={showNotifications}
            aria-haspopup="true"
            className="relative p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-md transition-colors"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-elevated rounded-xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">Notifications</h3>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium">
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={handleClearAll} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 dark:text-zinc-500 text-sm">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && handleMarkRead(n.id)}
                      className={cn(
                        'px-4 py-3 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors',
                        !n.read && 'bg-zinc-50 dark:bg-white/[0.03]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {!n.read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />}
                        <div className={cn('flex-1', n.read && 'ml-4')}>
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{formatRelativeTime(n.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
