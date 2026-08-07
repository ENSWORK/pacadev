'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface RiskGaugeProps {
  score: number
  explanation?: string
  onOverride?: (reason: string) => void
  userRole?: string
}

function getScoreColor(score: number): string {
  if (score <= 0.3) return '#10b981' // emerald
  if (score <= 0.6) return '#f59e0b' // amber
  return '#ef4444' // red
}

function getScoreLabel(score: number): string {
  if (score <= 0.3) return 'Faible'
  if (score <= 0.6) return 'Modéré'
  if (score <= 0.8) return 'Élevé'
  return 'Critique'
}

function RiskIcon({ score, className }: { score: number; className?: string }) {
  if (score <= 0.3) return <ShieldCheck className={className} />
  if (score <= 0.6) return <Shield className={className} />
  return <ShieldAlert className={className} />
}

export function RiskGauge({ score, explanation, onOverride, userRole = 'dev' }: RiskGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const clampedScore = Math.max(0, Math.min(1, score))
  const color = getScoreColor(clampedScore)
  const label = getScoreLabel(clampedScore)

  // Animate the needle
  useEffect(() => {
    const duration = 1000
    const startTime = Date.now()
    const startValue = animatedScore

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(startValue + (clampedScore - startValue) * eased)
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [clampedScore])

  // SVG semicircular gauge calculations
  const width = 200
  const height = 120
  const cx = width / 2
  const cy = height - 10
  const radius = 80
  const strokeWidth = 12

  // Angle: 180° (left) to 0° (right) mapped to score 0→1
  const needleAngle = Math.PI * (1 - animatedScore)
  const needleLength = radius - 20
  const needleX = cx + needleLength * Math.cos(needleAngle)
  const needleY = cy - needleLength * Math.sin(needleAngle)

  // Arc path for the background
  const arcStart = { x: cx - radius, y: cy }
  const arcEnd = { x: cx + radius, y: cy }

  // Colored arcs for each zone
  const describeArc = (startAngle: number, endAngle: number, r: number) => {
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy - r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy - r * Math.sin(endAngle)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const isLeadOrAbove = userRole === 'lead' || userRole === 'admin'
  const overrideDisabled = clampedScore > 0.8 && !overrideReason.trim()

  const handleOverride = () => {
    if (onOverride && overrideReason.trim()) {
      onOverride(overrideReason)
      setOverrideOpen(false)
      setOverrideReason('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative cursor-default">
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              className="overflow-visible"
            >
              {/* Background arc */}
              <path
                d={describeArc(Math.PI, 0, radius)}
                fill="none"
                stroke="currentColor"
                className="text-muted/30"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />

              {/* Green zone: 0-0.3 */}
              <path
                d={describeArc(Math.PI, Math.PI * 0.7, radius)}
                fill="none"
                stroke="#10b981"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.7}
              />

              {/* Yellow zone: 0.3-0.6 */}
              <path
                d={describeArc(Math.PI * 0.7, Math.PI * 0.4, radius)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.7}
              />

              {/* Red zone: 0.6-1.0 */}
              <path
                d={describeArc(Math.PI * 0.4, 0, radius)}
                fill="none"
                stroke="#ef4444"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.7}
              />

              {/* Tick marks */}
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const angle = Math.PI * (1 - tick)
                const innerR = radius - strokeWidth / 2 - 4
                const outerR = radius - strokeWidth / 2 - 10
                return (
                  <line
                    key={tick}
                    x1={cx + innerR * Math.cos(angle)}
                    y1={cy - innerR * Math.sin(angle)}
                    x2={cx + outerR * Math.cos(angle)}
                    y2={cy - outerR * Math.sin(angle)}
                    stroke="currentColor"
                    className="text-muted-foreground/40"
                    strokeWidth={1.5}
                  />
                )
              })}

              {/* Needle */}
              <line
                x1={cx}
                y1={cy}
                x2={needleX}
                y2={needleY}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                className="transition-all"
              />

              {/* Needle center dot */}
              <circle cx={cx} cy={cy} r={4} fill={color} />

              {/* Score text */}
              <text
                x={cx}
                y={cy - 30}
                textAnchor="middle"
                className="fill-foreground text-2xl font-bold"
                style={{ fontSize: '24px' }}
              >
                {clampedScore.toFixed(2)}
              </text>

              {/* Label text */}
              <text
                x={cx}
                y={cy - 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '11px' }}
              >
                {label}
              </text>

              {/* Min/Max labels */}
              <text
                x={arcStart.x - 5}
                y={arcStart.y + 15}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '10px' }}
              >
                0.0
              </text>
              <text
                x={arcEnd.x + 5}
                y={arcEnd.y + 15}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '10px' }}
              >
                1.0
              </text>
            </svg>

            {/* Glow effect for high scores */}
            {clampedScore > 0.6 && (
              <div
                className="absolute inset-0 rounded-full animate-pulse opacity-20"
                style={{
                  background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
                }}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">Score de risque IA : {clampedScore.toFixed(2)}</p>
          {explanation && <p className="text-xs mt-1 opacity-80">{explanation}</p>}
        </TooltipContent>
      </Tooltip>

      {/* Override button */}
      {onOverride && isLeadOrAbove && (
        <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
            >
              <RiskIcon score={clampedScore} className="size-3" />
              Outrepasser
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Outrepasser le score de risque</DialogTitle>
              <DialogDescription>
                Vous êtes sur le point d&apos;outrepasser le score de risque IA de{' '}
                <span className="font-bold" style={{ color }}>
                  {clampedScore.toFixed(2)}
                </span>
                . Cette action sera enregistrée dans les logs d&apos;audit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="override-reason">
                  Motif de l&apos;outrepassement {clampedScore > 0.8 && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="override-reason"
                  placeholder="Expliquez pourquoi vous souhaitez outrepasser ce score de risque..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="min-h-[80px]"
                />
                {clampedScore > 0.8 && !overrideReason.trim() && (
                  <p className="text-xs text-destructive">
                    Un motif est obligatoire pour les scores supérieurs à 0.8
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleOverride}
                disabled={overrideDisabled}
              >
                Confirmer l&apos;outrepassement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
