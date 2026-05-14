'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'

/**
 * Joins the project Socket.IO room and invalidates TanStack Query caches
 * whenever any collaborator mutates a task. Cleans up on unmount.
 */
export function useProjectSocket(projectId: string, orgId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!projectId || !orgId) return

    const socket = getSocket()
    if (!socket) return

    socket.emit('join:project', projectId)

    const invalidateTasks = () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] })
      qc.invalidateQueries({ queryKey: ['tasks-list', orgId, projectId] })
      qc.invalidateQueries({ queryKey: ['tasks-all', orgId, projectId] })
    }

    const invalidateAll = () => {
      invalidateTasks()
      qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
      qc.invalidateQueries({ queryKey: ['burndown', orgId, projectId] })
    }

    socket.on('task:created', invalidateAll)
    socket.on('task:updated', invalidateTasks)
    socket.on('task:moved', invalidateTasks)
    socket.on('task:deleted', invalidateAll)
    socket.on('tasks:bulk-updated', invalidateAll)

    return () => {
      socket.emit('leave:project', projectId)
      socket.off('task:created', invalidateAll)
      socket.off('task:updated', invalidateTasks)
      socket.off('task:moved', invalidateTasks)
      socket.off('task:deleted', invalidateAll)
      socket.off('tasks:bulk-updated', invalidateAll)
    }
  }, [projectId, orgId, qc])
}
