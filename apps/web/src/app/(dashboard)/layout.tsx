'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Sidebar } from '@/components/layout/Sidebar'
import { LoadingScreen } from '@/components/ui/Spinner'
import { connectSocket } from '@/lib/socket'
import { useNotificationStore } from '@/store/notification.store'
import toast from 'react-hot-toast'
import { Notification } from '@/types'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore()
  const router = useRouter()
  const addNotification = useNotificationStore((s) => s.addNotification)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Zustand persist starts with null defaults and rehydrates from localStorage async.
  // We must wait for hydration before checking auth — otherwise every refresh redirects to login.
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!accessToken) return

    const socket = connectSocket(accessToken)

    socket.on('notification:new', (notification: Notification) => {
      addNotification(notification)
      toast(notification.title, { icon: '🔔' })
    })

    socket.on('connect_error', (err) => {
      console.warn('Socket error:', err.message)
    })

    return () => {
      socket.off('notification:new')
    }
  }, [hydrated, user, accessToken, router, addNotification])

  if (!hydrated || !user) return <LoadingScreen />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-indigo-600 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden focus:outline-none min-w-0">
        {/* Mobile header bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">ProjectFlow</span>
        </div>
        {children}
      </main>
    </div>
  )
}
