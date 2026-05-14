import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) return socket
  socket = io('http://localhost:3001', {
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
