import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const BACKEND_URL = 'http://localhost:3000'

export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    console.log('[WebSocket] 서버 연결 시도:', BACKEND_URL)
    
    const newSocket = io(BACKEND_URL)

    newSocket.on('connect', () => {
      console.log('[WebSocket] ✅ 서버 연결 성공!')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('[WebSocket] ❌ 서버 연결 끊김')
      setConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] 연결 오류:', error.message)
      setConnected(false)
    })

    setSocket(newSocket)

    // 컴포넌트 언마운트 시 연결 종료
    return () => {
      console.log('[WebSocket] 연결 종료')
      newSocket.close()
    }
  }, [])

  return { socket, connected }
}