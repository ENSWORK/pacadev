'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const setWsConnected = useAppStore((s) => s.setWsConnected)

  useEffect(() => {
    // Detect local/dev environment: localhost, 192.168.x.x, or *.pacadev.local
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.endsWith('.pacadev.local') ||
      window.location.hostname === 'pacadev.local'
    )
    const WS_URL = isLocal
      ? 'http://localhost:3003'   // direct (dev / Traefik local)
      : '/?XTransformPort=3003'   // Caddy gateway (production)
    const socket = io(WS_URL, {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    })

    socket.on('connect', () => {
      console.log('[WS] Connected to WebSocket service')
      setConnected(true)
      setWsConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[WS] Disconnected: ${reason}`)
      setConnected(false)
      setWsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message)
      setConnected(false)
      setWsConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [setWsConnected])

  const subscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      socketRef.current?.on(event, callback)
      return () => {
        socketRef.current?.off(event, callback)
      }
    },
    []
  )

  const unsubscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      socketRef.current?.off(event, callback)
    },
    []
  )

  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit('join', room)
  }, [])

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit('leave', room)
  }, [])

  const ping = useCallback(() => {
    socketRef.current?.emit('ping')
  }, [])

  return {
    connected,
    subscribe,
    unsubscribe,
    joinRoom,
    leaveRoom,
    ping,
  }
}
