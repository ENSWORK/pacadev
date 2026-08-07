'use client'

import { Check, X, Loader2, SkipForward, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PipelineStep {
  name: string
  status: string
  logs?: string
}

interface PipelineTimelineProps {
  steps: PipelineStep[]
  onStepClick?: (stepName: string) => void
}

type StepStatus = 'success' | 'running' | 'failed' | 'pending' | 'skipped'

function normalizeStatus(status: string): StepStatus {
  const map: Record<string, StepStatus> = {
    success: 'success',
    ok: 'success',
    passed: 'success',
    running: 'running',
    in_progress: 'running',
    failed: 'failed',
    error: 'failed',
    pending: 'pending',
    waiting: 'pending',
    skipped: 'skipped',
  }
  return map[status.toLowerCase()] ?? 'pending'
}

const statusConfig: Record<StepStatus, { color: string; bg: string; border: string; icon: React.ElementType; label: string; pulseClass: string }> = {
  success: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-300 dark:border-emerald-700',
    icon: Check,
    label: 'Réussi',
    pulseClass: '',
  },
  running: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-300 dark:border-amber-700',
    icon: Loader2,
    label: 'En cours',
    pulseClass: 'animate-pulse',
  },
  failed: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-300 dark:border-red-700',
    icon: X,
    label: 'Échoué',
    pulseClass: '',
  },
  pending: {
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    border: 'border-slate-300 dark:border-slate-600',
    icon: Clock,
    label: 'En attente',
    pulseClass: '',
  },
  skipped: {
    color: 'text-slate-400 dark:text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-800/30',
    border: 'border-slate-200 dark:border-slate-700',
    icon: SkipForward,
    label: 'Ignoré',
    pulseClass: '',
  },
}

const defaultSteps: PipelineStep[] = [
  { name: 'Lint', status: 'pending' },
  { name: 'Tests', status: 'pending' },
  { name: 'Security', status: 'pending' },
  { name: 'IA Risk', status: 'pending' },
  { name: 'Deploy', status: 'pending' },
]

export function PipelineTimeline({ steps = defaultSteps, onStepClick }: PipelineTimelineProps) {
  const hasRunning = steps.some((s) => normalizeStatus(s.status) === 'running')

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-center gap-0 min-w-[400px] py-4 px-2">
        {steps.map((step, index) => {
          const normalized = normalizeStatus(step.status)
          const config = statusConfig[normalized]
          const Icon = config.icon
          const isLast = index === steps.length - 1
          const isRunning = normalized === 'running'

          return (
            <div key={step.name} className="flex items-center">
              {/* Step circle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onStepClick?.(step.name)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 group cursor-pointer',
                    )}
                  >
                    <div
                      className={cn(
                        'relative flex items-center justify-center size-10 rounded-full border-2 transition-all',
                        config.bg,
                        config.border,
                        isRunning && 'ring-4 ring-amber-200/50 dark:ring-amber-800/30',
                        'group-hover:scale-110 group-hover:shadow-md',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4',
                          config.color,
                          isRunning && 'animate-spin',
                        )}
                      />
                      {/* Glow for running step */}
                      {isRunning && (
                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-amber-400" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium whitespace-nowrap',
                        normalized === 'pending' || normalized === 'skipped'
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                      )}
                    >
                      {step.name}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">{step.name}</p>
                  <p className="text-xs opacity-80">{config.label}</p>
                  {step.logs && (
                    <p className="text-xs mt-1 opacity-60 max-w-[200px] truncate">{step.logs}</p>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Connector line */}
              {!isLast && (
                <div className="flex items-center mx-1">
                  <div
                    className={cn(
                      'h-0.5 w-8 transition-colors',
                      normalized === 'success'
                        ? 'bg-emerald-400 dark:bg-emerald-600'
                        : normalized === 'running'
                          ? 'bg-amber-300 dark:bg-amber-700 bg-gradient-to-r from-amber-400 to-amber-200'
                          : 'bg-slate-200 dark:bg-slate-700',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
