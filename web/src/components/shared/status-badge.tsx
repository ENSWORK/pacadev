'use client'

import { CheckCircle2, AlertTriangle, XCircle, Clock, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusCategory = 'success' | 'warning' | 'error' | 'pending' | 'rolled_back'

const statusMap: Record<string, StatusCategory> = {
  ok: 'success',
  success: 'success',
  up: 'success',
  healthy: 'success',
  completed: 'success',
  installed: 'success',
  passed: 'success',
  synced: 'success',
  warning: 'warning',
  running: 'warning',
  degraded: 'warning',
  upload_ok: 'warning',
  verifying: 'warning',
  upgrade_available: 'warning',
  ahead: 'warning',
  in_progress: 'warning',
  uploading: 'warning',
  error: 'error',
  failed: 'error',
  critical: 'error',
  down: 'error',
  active: 'error',
  pending: 'pending',
  disabled: 'pending',
  acknowledged: 'pending',
  behind: 'pending',
  open: 'pending',
  info: 'pending',
  rolled_back: 'rolled_back',
  diverged: 'rolled_back',
}

const categoryStyles: Record<StatusCategory, { bg: string; text: string; icon: React.ElementType }> = {
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: XCircle,
  },
  pending: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
    icon: Clock,
  },
  rolled_back: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
    icon: RotateCcw,
  },
}

const sizeStyles = {
  sm: 'px-1.5 py-0 text-[10px] gap-0.5',
  md: 'px-2 py-0.5 text-xs gap-1',
}

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export function StatusBadge({ status, size = 'md', showIcon = false }: StatusBadgeProps) {
  const category = statusMap[status.toLowerCase()] ?? 'pending'
  const style = categoryStyles[category]
  const Icon = style.icon

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap shrink-0 border border-transparent',
        style.bg,
        style.text,
        sizeStyles[size],
      )}
    >
      {showIcon && <Icon className={size === 'sm' ? 'size-2.5' : 'size-3'} />}
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </span>
  )
}
