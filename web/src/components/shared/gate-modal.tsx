'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Timer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface GateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: string
  client: string
  environment: 'staging' | 'prod'
  impact?: string
  onConfirm: (reason: string) => void
}

const TIMEOUT_SECONDS = 15 * 60 // 15 minutes

export function GateModal({
  open,
  onOpenChange,
  action,
  client,
  environment,
  impact,
  onConfirm,
}: GateModalProps) {
  const [reason, setReason] = useState('')
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS)
  const isProd = environment === 'prod'
  const canConfirm = isProd ? reason.trim().length > 0 : true

  // Use ref to access onOpenChange in the interval callback without triggering effect deps
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  const resetState = useCallback(() => {
    setReason('')
    setTimeLeft(TIMEOUT_SECONDS)
  }, [])

  const handleCancel = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [onOpenChange, resetState])

  // Countdown timer - only runs when dialog is open
  // When timer hits 0, auto-cancel from within the interval (not from a separate effect)
  useEffect(() => {
    if (!open) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          // Auto-cancel: close dialog and reset
          // Use setTimeout to defer state updates outside the setter
          setTimeout(() => {
            setReason('')
            setTimeLeft(TIMEOUT_SECONDS)
            onOpenChangeRef.current(false)
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isUrgent = timeLeft < 120 // Less than 2 minutes

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(reason.trim())
      resetState()
      onOpenChange(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Confirmation requise
          </DialogTitle>
          <DialogDescription>
            Cette action est critique et sera enregistrée dans les logs d&apos;audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action details */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Action</span>
              <span className="text-sm font-medium">{action}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Client</span>
              <span className="text-sm font-medium">{client}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Environnement</span>
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px]',
                  isProd
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                )}
              >
                {isProd ? 'Production' : 'Staging'}
              </Badge>
            </div>
            {impact && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Impact estimé</span>
                <span className="text-sm font-medium">{impact}</span>
              </div>
            )}
          </div>

          {/* Timer */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              isUrgent
                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Timer className="size-4" />
            <span>
              Temps restant : <strong>{formatTime(timeLeft)}</strong>
            </span>
          </div>

          {/* Reason field */}
          <div className="space-y-2">
            <Label htmlFor="gate-reason">
              Motif {isProd && <span className="text-destructive">*</span>}
              {!isProd && (
                <span className="text-muted-foreground font-normal"> (optionnel)</span>
              )}
            </Label>
            <Textarea
              id="gate-reason"
              placeholder={
                isProd
                  ? 'Obligatoire : expliquez la raison de cette action en production...'
                  : 'Expliquez la raison de cette action (optionnel)...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            {isProd && !reason.trim() && (
              <p className="text-xs text-destructive">
                Le motif est obligatoire pour les déploiements en production
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
