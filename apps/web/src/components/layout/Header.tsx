'use client'
import { useState, useEffect } from 'react'
import { Bell, ArrowLeft, Search } from 'lucide-react'
import { useNotificationStore } from '@/store/notification.store'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Notification } from '@/types'
import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/ui/CommandPalette'

export function Header({ title, subtitle, backHref, titleSuffix }: {
  title?: string
  subtitle?: string
  backHref?: string
  titleSuffix?: React.ReactNode
}) {
  const router = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

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
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {backHref && (
          <button onClick={() => router.back()} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Go back">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {titleSuffix}
          </div>
          {subtitle && <p className="text-xs text-gray-400 -mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowPalette(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          aria-label="Open search (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search</span>
          <kbd className="ml-1 text-xs font-mono bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-400">⌘K</kbd>
        </button>

        <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
            aria-expanded={showNotifications}
            aria-haspopup="true"
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-indigo-600 hover:text-indigo-700">
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
                  <div className="py-8 text-center text-gray-500 text-sm">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && handleMarkRead(n.id)}
                      className={cn(
                        'px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors',
                        !n.read && 'bg-indigo-50/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {!n.read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />}
                        <div className={cn('flex-1', n.read && 'ml-5')}>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
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
