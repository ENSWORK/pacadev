'use client'

import React from 'react'
import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface WorkflowStep {
  id: string
  label: string
  icon?: React.ElementType
  status: 'completed' | 'in_progress' | 'pending' | 'failed'
  details?: string
  responsible?: string
  since?: string
}

interface WorkflowProgressBarProps {
  steps: WorkflowStep[]
  currentStep?: string
  onStepClick?: (stepId: string) => void
  compact?: boolean
}

function getConnectorColor(
  prevStep: WorkflowStep,
  currentStep: WorkflowStep
): string {
  if (prevStep.status === 'completed' && currentStep.status === 'completed') {
    return 'bg-emerald-500'
  }
  if (currentStep.status === 'failed') {
    return 'bg-red-500'
  }
  if (
    (prevStep.status === 'completed' || prevStep.status === 'in_progress') &&
    currentStep.status === 'in_progress'
  ) {
    return 'bg-blue-500'
  }
  return 'bg-gray-300 dark:bg-gray-600'
}

function isConnectorAnimated(
  prevStep: WorkflowStep,
  currentStep: WorkflowStep
): boolean {
  return (
    (prevStep.status === 'completed' || prevStep.status === 'in_progress') &&
    currentStep.status === 'in_progress'
  )
}

function StepCircle({
  step,
  compact,
  isCurrent,
  onClick,
}: {
  step: WorkflowStep
  compact?: boolean
  isCurrent: boolean
  onClick?: () => void
}) {
  const size = compact ? 'h-6 w-6' : 'h-8 w-8'
  const iconSize = compact ? 14 : 18

  const baseClasses = cn(
    'relative flex items-center justify-center rounded-full border-2 transition-all duration-200',
    size,
    step.status === 'completed' &&
      'border-emerald-500 bg-emerald-500 text-white',
    step.status === 'in_progress' &&
      'border-blue-500 bg-blue-500/10 text-blue-500',
    step.status === 'pending' &&
      'border-gray-300 bg-background text-gray-400 dark:border-gray-600 dark:text-gray-500',
    step.status === 'failed' && 'border-red-500 bg-red-500 text-white',
    isCurrent && 'ring-2 ring-blue-500/30 ring-offset-2 ring-offset-background',
    onClick && 'cursor-pointer hover:scale-110'
  )

  const content = (() => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 size={iconSize} className="text-white" />
      case 'in_progress':
        return (
          <span className="relative flex items-center justify-center">
            {/* Pulse ring */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-30" />
            <Loader2
              size={iconSize}
              className="animate-spin text-blue-500"
            />
          </span>
        )
      case 'failed':
        return <XCircle size={iconSize} className="text-white" />
      case 'pending':
      default:
        return step.icon ? (
          <step.icon size={iconSize} />
        ) : (
          <Circle size={iconSize} className="text-gray-400 dark:text-gray-500" />
        )
    }
  })()

  return (
    <button
      type="button"
      className={baseClasses}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${step.label} - ${step.status}`}
    >
      {content}
    </button>
  )
}

function StepTooltipContent({ step }: { step: WorkflowStep }) {
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-sm">{step.label}</p>
      <p className="capitalize text-primary-foreground/80">
        Status: {step.status.replace('_', ' ')}
      </p>
      {step.details && (
        <p className="text-primary-foreground/70">{step.details}</p>
      )}
      {step.responsible && (
        <p className="text-primary-foreground/70">
          Responsible: {step.responsible}
        </p>
      )}
      {step.since && (
        <p className="text-primary-foreground/70">Since: {step.since}</p>
      )}
    </div>
  )
}

function Connector({
  prevStep,
  currentStep,
  compact,
}: {
  prevStep: WorkflowStep
  currentStep: WorkflowStep
  compact?: boolean
}) {
  const color = getConnectorColor(prevStep, currentStep)
  const animated = isConnectorAnimated(prevStep, currentStep)
  const height = compact ? 'h-0.5' : 'h-[3px]'

  return (
    <div className="relative flex-1 min-w-[24px] md:min-w-[40px] self-center">
      <div
        className={cn(height, 'w-full rounded-full transition-colors', color)}
      />
      {animated && (
        <div
          className={cn(
            height,
            'absolute inset-0 w-full rounded-full bg-blue-400 animate-pulse'
          )}
        />
      )}
    </div>
  )
}

export function WorkflowProgressBar({
  steps,
  currentStep,
  onStepClick,
  compact = false,
}: WorkflowProgressBarProps) {
  if (!steps || steps.length === 0) return null

  return (
    <div
      className={cn(
        'w-full',
        compact ? 'overflow-x-auto' : 'overflow-x-auto'
      )}
      role="progressbar"
      aria-valuenow={
        steps.filter((s) => s.status === 'completed').length
      }
      aria-valuemin={0}
      aria-valuemax={steps.length}
    >
      <div
        className={cn(
          'flex items-start',
          compact ? 'gap-1 min-w-min' : 'gap-0 min-w-min px-2'
        )}
      >
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep
          const prevStep = index > 0 ? steps[index - 1] : null

          return (
            <React.Fragment key={step.id}>
              {/* Connector line before this step (except first) */}
              {prevStep && (
                <Connector
                  prevStep={prevStep}
                  currentStep={step}
                  compact={compact}
                />
              )}

              {/* Step node */}
              <div
                className={cn(
                  'flex flex-col items-center shrink-0',
                  compact ? 'gap-0.5' : 'gap-1.5'
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <StepCircle
                        step={step}
                        compact={compact}
                        isCurrent={isCurrent}
                        onClick={
                          onStepClick ? () => onStepClick(step.id) : undefined
                        }
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    <StepTooltipContent step={step} />
                  </TooltipContent>
                </Tooltip>

                {/* Label */}
                {!compact && (
                  <span
                    className={cn(
                      'text-xs text-center max-w-[80px] leading-tight',
                      isCurrent
                        ? 'font-semibold text-blue-600 dark:text-blue-400'
                        : step.status === 'completed'
                          ? 'font-medium text-emerald-600 dark:text-emerald-400'
                          : step.status === 'failed'
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default WorkflowProgressBar
