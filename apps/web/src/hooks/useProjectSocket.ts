'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth.store'

export function useProjectSocket(projectId: string, orgId: string) {
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!projectId || !orgId || !accessToken) return

    // connectSocket is idempotent — returns the existing socket if already created.
    // We call it here (not just getSocket) because React runs child effects before
    // parent effects, so the layout's connectSocket call may not have run yet.
    const socket = connectSocket(accessToken)

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

    let joined = false
    const join = () => {
      joined = true
      socket.emit('join:project', projectId)
      socket.on('task:created', invalidateAll)
      socket.on('task:updated', invalidateTasks)
      socket.on('task:moved', invalidateTasks)
      socket.on('task:deleted', invalidateAll)
      socket.on('tasks:bulk-updated', invalidateAll)
    }

    if (socket.connected) {
      join()
    } else {
      socket.once('connect', join)
    }

    return () => {
      // Remove the pending connect listener if we never got a connection
      socket.off('connect', join)
      if (joined) {
        socket.emit('leave:project', projectId)
        socket.off('task:created', invalidateAll)
        socket.off('task:updated', invalidateTasks)
        socket.off('task:moved', invalidateTasks)
        socket.off('task:deleted', invalidateAll)
        socket.off('tasks:bulk-updated', invalidateAll)
      }
    }
  }, [projectId, orgId, qc, accessToken])
}
