'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'

/**
 * Joins the task Socket.IO room so that comments and activity added
 * by other collaborators appear in real-time inside the task detail modal.
 */
export function useTaskSocket(taskId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!taskId) return

    const socket = getSocket()
    if (!socket) return

    socket.emit('join:task', taskId)

    const onComment = () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] })
      qc.invalidateQueries({ queryKey: ['activities', taskId] })
    }

    socket.on('comment:created', onComment)

    return () => {
      socket.emit('leave:task', taskId)
      socket.off('comment:created', onComment)
    }
  }, [taskId, qc])
}
