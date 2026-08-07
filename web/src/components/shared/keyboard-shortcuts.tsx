'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * Global keyboard shortcuts for PACADEV Web UI
 *
 * Ctrl+N → New ticket (open workspace with ticket creator)
 * Ctrl+W → Start workspace
 * Ctrl+L → Open logs (observability)
 * Ctrl+K → Global search (command palette)
 * ?      → Help (show shortcuts)
 */
export function KeyboardShortcuts() {
  const { setCurrentView, setCommandPaletteOpen, setTicketCreatorOpen } = useAppStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isCtrl = e.ctrlKey || e.metaKey

      // Ctrl+N → New ticket
      if (isCtrl && e.key === 'n') {
        e.preventDefault()
        setTicketCreatorOpen(true)
        setCurrentView('workspace')
        return
      }

      // Ctrl+W → Start workspace
      if (isCtrl && e.key === 'w') {
        e.preventDefault()
        setCurrentView('workspace')
        return
      }

      // Ctrl+L → Open logs
      if (isCtrl && e.key === 'l') {
        e.preventDefault()
        setCurrentView('observability')
        return
      }

      // Ctrl+K → Command palette
      if (isCtrl && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentView, setCommandPaletteOpen, setTicketCreatorOpen])

  return null
}
