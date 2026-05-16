import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) return socket
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
  const socketUrl = apiUrl.replace('/api/v1', '')
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  })
  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

export const getSocket = () => socket
