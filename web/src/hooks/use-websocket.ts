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
    // URL du WebSocket : toujours le même hôte que la page, port 3003.
    // - Navigateur sur le serveur (localhost) → localhost:3003 (direct)
    // - Accès réseau (pacadev.local, IP, …)  → <hôte>:3003 (port WS exposé côté hôte)
    // NB : "http://localhost:3003" en dur cassait l'accès distant (résolu côté navigateur).
    const WS_URL = `${window.location.protocol}//${window.location.hostname}:3003`
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
