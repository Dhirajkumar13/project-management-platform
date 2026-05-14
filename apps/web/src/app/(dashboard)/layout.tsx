'use client'
import { useEffect } from 'react'
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

  useEffect(() => {
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
  }, [user, accessToken, router, addNotification])

  if (!user) return <LoadingScreen />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-indigo-600 focus:outline-none"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden focus:outline-none">
        {children}
      </main>
    </div>
  )
}
