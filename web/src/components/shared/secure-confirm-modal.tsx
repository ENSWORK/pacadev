'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Timer, Terminal, CheckCircle2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface SecureConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  impact?: string
  requiresReason?: boolean
  timeout?: number
  cliCommand?: string
  onConfirm: (reason: string) => void
  variant?: 'destructive' | 'warning' | 'default'
}

const DEFAULT_TIMEOUT_MINUTES = 15

const variantStyles: Record<
  NonNullable<SecureConfirmModalProps['variant']>,
  { border: string; headerIcon: string; confirmVariant: 'destructive' | 'default' }
> = {
  destructive: {
    border: 'border-red-500/50 dark:border-red-500/40',
    headerIcon: 'text-red-600 dark:text-red-400',
    confirmVariant: 'destructive',
  },
  warning: {
    border: 'border-amber-500/50 dark:border-amber-500/40',
    headerIcon: 'text-amber-600 dark:text-amber-400',
    confirmVariant: 'default',
  },
  default: {
    border: 'border-border',
    headerIcon: 'text-muted-foreground',
    confirmVariant: 'default',
  },
}

export function SecureConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  impact,
  requiresReason = true,
  timeout = DEFAULT_TIMEOUT_MINUTES,
  cliCommand,
  onConfirm,
  variant = 'default',
}: SecureConfirmModalProps) {
  const { toast } = useToast()

  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timeout * 60)

  const timeoutSeconds = timeout * 60
  const onOpenChangeRef = useRef(onOpenChange)
  const onConfirmRef = useRef(onConfirm)
  const toastRef = useRef(toast)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useEffect(() => {
    onConfirmRef.current = onConfirm
  }, [onConfirm])

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const resetState = useCallback(() => {
    setReason('')
    setAcknowledged(false)
    setTimeLeft(timeoutSeconds)
  }, [timeoutSeconds])

  const handleCancel = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [onOpenChange, resetState])

  // Countdown timer - only runs when dialog is open
  useEffect(() => {
    if (!open) return

    let countdown = timeoutSeconds

    const interval = setInterval(() => {
      countdown -= 1
      if (countdown <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        // Auto-cancel on timeout: close dialog, reset, show toast
        setTimeout(() => {
          setReason('')
          setAcknowledged(false)
          setTimeLeft(timeoutSeconds)
          onOpenChangeRef.current(false)
          toastRef.current({
            title: 'Action annulée',
            description: 'Délai expiré',
            variant: 'destructive',
          })
        }, 0)
        return
      }
      setTimeLeft(countdown)
    }, 1000)

    return () => clearInterval(interval)
  }, [open, timeoutSeconds])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isUrgent = timeLeft < 120 // Less than 2 minutes
  const hasReason = reason.trim().length > 0
  const canConfirm = acknowledged && (!requiresReason || hasReason)

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

  const style = variantStyles[variant]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn('sm:max-w-lg', style.border)}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={cn('size-5', style.headerIcon)} />
            {title}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Countdown Timer */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              isUrgent
                ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                : 'bg-muted text-muted-foreground',
              isUrgent && 'animate-pulse',
            )}
          >
            <Timer className="size-4 shrink-0" />
            <span>
              Temps restant : <strong>{formatTime(timeLeft)}</strong>
            </span>
            {isUrgent && (
              <Badge
                variant="destructive"
                className="ml-auto text-[10px]"
              >
                Urgent
              </Badge>
            )}
          </div>

          {/* Impact Section */}
          {impact && (
            <div className="rounded-md border border-red-300/60 bg-red-50 p-3 dark:border-red-700/40 dark:bg-red-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Impact estimé
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {impact}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CLI Command Section */}
          {cliCommand && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Terminal className="size-3.5" />
                Commande équivalente
              </Label>
              <div className="relative overflow-hidden rounded-md border bg-zinc-950 dark:bg-zinc-900">
                <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-1.5">
                  <span className="size-2 rounded-full bg-red-500" />
                  <span className="size-2 rounded-full bg-yellow-500" />
                  <span className="size-2 rounded-full bg-green-500" />
                  <span className="ml-2 text-[10px] font-medium text-zinc-500">Terminal</span>
                </div>
                <pre className="overflow-x-auto p-3">
                  <code className="text-sm text-green-400">{cliCommand}</code>
                </pre>
              </div>
            </div>
          )}

          {/* Reason Field */}
          {requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="secure-reason">
                Motif <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="secure-reason"
                placeholder="Obligatoire : expliquez la raison de cette action..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
              />
              {!hasReason && (
                <p className="text-xs text-destructive">
                  Le motif est obligatoire pour confirmer cette action
                </p>
              )}
            </div>
          )}

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="secure-ack"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              disabled={requiresReason && !hasReason}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="secure-ack"
                className={cn(
                  'text-sm leading-snug',
                  requiresReason && !hasReason && 'cursor-not-allowed opacity-50',
                )}
              >
                J&apos;ai compris l&apos;impact
              </Label>
              {requiresReason && !hasReason && (
                <p className="text-xs text-muted-foreground">
                  Veuillez d&apos;abord saisir un motif
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Annuler
          </Button>
          <Button
            variant={style.confirmVariant}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
