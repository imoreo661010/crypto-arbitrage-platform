import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    console.log('[WebSocket] 서버 연결 시도:', SOCKET_URL)
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    })

    newSocket.on('connect', () => {
      console.log('[WebSocket] 연결 성공!')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('[WebSocket] 연결 종료')
      setConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.log('[WebSocket] 연결 오류:', error.message)
      setConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  return { socket, connected }
}