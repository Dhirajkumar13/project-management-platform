'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth.store'

export function useTaskSocket(taskId: string) {
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!taskId || !accessToken) return

    const socket = connectSocket(accessToken)

    const onComment = () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] })
      qc.invalidateQueries({ queryKey: ['activities', taskId] })
    }

    let joined = false
    const join = () => {
      joined = true
      socket.emit('join:task', taskId)
      socket.on('comment:created', onComment)
    }

    if (socket.connected) {
      join()
    } else {
      socket.once('connect', join)
    }

    return () => {
      socket.off('connect', join)
      if (joined) {
        socket.emit('leave:task', taskId)
        socket.off('comment:created', onComment)
      }
    }
  }, [taskId, qc, accessToken])
}
