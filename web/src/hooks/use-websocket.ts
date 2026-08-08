'use client'

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/lib/store'

// Socket partagé (singleton module) : tous les appels à useWebSocket()
// réutilisent la même connexion vers le service WS (port 3003).
let sharedSocket: Socket | null = null
let connectedFlag = false

function getSocket(): Socket {
  if (!sharedSocket) {
    // URL du WebSocket : toujours le même hôte que la page, port 3003.
    // - Navigateur sur le serveur (localhost) → localhost:3003 (direct)
    // - Accès réseau (pacadev.local, IP, …)  → <hôte>:3003 (port WS exposé côté hôte)
    // NB : "http://localhost:3003" en dur cassait l'accès distant (résolu côté navigateur).
    const WS_URL = `${window.location.protocol}//${window.location.hostname}:3003`
    sharedSocket = io(WS_URL, {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      // Reconnexion illimitée : auto-guérison après redémarrage du poste /
      // coupure réseau sans recharger la page.
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
    })
  }
  return sharedSocket
}

export function useWebSocket() {
  const [connected, setConnected] = useState(connectedFlag)
  const setWsConnected = useAppStore((s) => s.setWsConnected)

  useEffect(() => {
    const socket = getSocket()

    const handleConnect = () => {
      connectedFlag = true
      setConnected(true)
      setWsConnected(true)
    }
    const handleDisconnect = (reason: string) => {
      connectedFlag = false
      setConnected(false)
      setWsConnected(false)
      void reason
    }
    const handleError = () => {
      connectedFlag = false
      setConnected(false)
      setWsConnected(false)
    }

    // Si déjà connectée, resynchroniser l'état local immédiatement
    if (socket.connected && !connectedFlag) handleConnect()

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleError)
    }
  }, [setWsConnected])

  const subscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      getSocket().on(event, callback)
      return () => {
        getSocket().off(event, callback)
      }
    },
    []
  )

  const unsubscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      getSocket().off(event, callback)
    },
    []
  )

  const joinRoom = useCallback((room: string) => {
    getSocket().emit('join', room)
  }, [])

  const leaveRoom = useCallback((room: string) => {
    getSocket().emit('leave', room)
  }, [])

  const ping = useCallback(() => {
    getSocket().emit('ping')
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
