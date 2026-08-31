'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Play,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  GitBranch,
  GitCommit,
  User,
  Clock,
  Link2,
  ShieldCheck,
  XCircle,
  ExternalLink,
  Copy,
  Eye,
  Ban,
  RefreshCw,
  Zap,
  Rocket,
  AlertTriangle,
  Loader2,
  Terminal,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PipelineTimeline } from '@/components/shared/pipeline-timeline'
import { GateModal } from '@/components/shared/gate-modal'
import { SecureConfirmModal } from '@/components/shared/secure-confirm-modal'
import { StatusBadge } from '@/components/shared/status-badge'
import { mockPipelines, mockClients } from '@/lib/mock-data'
import type { Pipeline } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useWebSocket } from '@/hooks/use-websocket'
import { loadPipelines } from '@/lib/pipeline-loader'
import { pipelineApi, deployApi, aiApi, secretsApi } from '@/lib/api'
import { useAppStore, type RealPipeline } from '@/lib/store'

type AnyPipeline = Pipeline | RealPipeline

// ============ Types données réelles ============
interface SecurityScanData {
  runId: number
  commitHash: string
  scannedAt: string
  bandit: { conclusion: string; passed: boolean }
  gitleaks: { conclusion: string; passed: boolean }
  overallOk: boolean
  riskScore: number
  url: string
}

interface ApprovalEntry {
  timestamp: string
  token: string
  client: string
  action: string
  reason: string
  user: string
  used: boolean
  used_at: string | null
  used_by: string | null
}

// ============ Flux de logs pipeline réel (WebSocket port 3003) ============
interface LiveLogLine {
  time: string
  level: string
  msg: string
}

interface LiveStream {
  runId: string
  lines: LiveLogLine[]
  status: string
  conclusion: string | null
}

function getClientSlugOf(pipeline: AnyPipeline): string {
  if ('clientSlug' in pipeline && pipeline.clientSlug) return pipeline.clientSlug
  const { realClients } = useAppStore.getState()
  const all = realClients.length > 0 ? realClients : mockClients
  return all.find((c) => c.id === pipeline.clientId)?.slug ?? all[0]?.slug ?? ''
}

// ============ Helper ============
function getClientName(clientId: string): string {
  const { realClients } = useAppStore.getState()
  const all = realClients.length > 0 ? realClients : mockClients
  const client = all.find((c) => c.id === clientId)
  return client?.name ?? clientId
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const levelColors: Record<string, string> = {
  INFO: 'text-emerald-600 dark:text-emerald-400',
  SUCCESS: 'text-emerald-600 dark:text-emerald-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  ERROR: 'text-red-600 dark:text-red-400',
  DEBUG: 'text-slate-500 dark:text-slate-400',
}

// ============ Pipeline En Cours Section ============
function PipelineEnCours() {
  const { realPipelines, setRealPipelines, realClients } = useAppStore()
  const effectivePipelines: AnyPipeline[] = realPipelines.length > 0 ? realPipelines : mockPipelines
  const [logsExpanded, setLogsExpanded] = useState(true)
  const { connected: wsConnected, subscribe } = useWebSocket()
  const [liveStreams, setLiveStreams] = useState<Record<string, LiveStream>>({})
  const refreshingRef = useRef(false)

  const refreshPipelines = useCallback(async () => {
    if (refreshingRef.current || realClients.length === 0) return
    refreshingRef.current = true
    try {
      const refreshed = await loadPipelines(realClients)
      if (refreshed.length > 0) setRealPipelines(refreshed)
    } catch { /* garder l'état courant */ } finally {
      refreshingRef.current = false
    }
  }, [realClients, setRealPipelines])

  useEffect(() => {
    const offLogs = subscribe('pipeline:logs', (data) => {
      const d = data as { client?: string; runId?: number; lines?: LiveLogLine[] }
      if (!d?.client || !Array.isArray(d.lines) || d.lines.length === 0) return
      setLiveStreams((prev) => {
        const current = prev[d.client!]
        if (current && current.runId !== String(d.runId)) {
          // Nouveau run : remplacer le tampon de logs du client
          return { ...prev, [d.client!]: { runId: String(d.runId), lines: d.lines!.slice(-400), status: current.status, conclusion: current.conclusion } }
        }
        const lines = [...(current?.lines ?? []), ...d.lines!].slice(-400)
        return { ...prev, [d.client!]: { runId: String(d.runId), lines, status: current?.status ?? 'completed', conclusion: current?.conclusion ?? null } }
      })
    })

    const offStatus = subscribe('pipeline:status', (data) => {
      const d = data as { client?: string; runId?: number; status?: string; conclusion?: string | null }
      if (!d?.client) return
      setLiveStreams((prev) => {
        const current = prev[d.client!]
        if (current && current.runId === String(d.runId)) {
          return { ...prev, [d.client!]: { ...current, status: d.status ?? current.status, conclusion: d.conclusion ?? current.conclusion } }
        }
        return { ...prev, [d.client!]: { runId: String(d.runId), lines: [], status: d.status ?? 'completed', conclusion: d.conclusion ?? null } }
      })
      if (d.status === 'completed' || d.status === 'in_progress' || d.status === 'queued') refreshPipelines()
    })

    return () => {
      offLogs()
      offStatus()
    }
  }, [subscribe, refreshPipelines])

  // Dernier run par client (API), la carte reflète l'état temps réel via WS
  const cards = useMemo(() => {
    const latestBySlug = new Map<string, AnyPipeline>()
    for (const p of effectivePipelines) {
      const slug = getClientSlugOf(p)
      if (slug && !latestBySlug.has(slug)) latestBySlug.set(slug, p)
    }
    return Array.from(latestBySlug.values())
  }, [effectivePipelines])

  if (cards.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="size-5 text-amber-500" />
            Pipeline en cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="size-10 mb-3 opacity-40" />
            <p className="text-sm">Aucun run récent pour vos clients</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {cards.map((pipeline) => {
        const clientSlug = getClientSlugOf(pipeline)
        return (
          <PipelineCard
            key={clientSlug}
            pipeline={pipeline}
            logsExpanded={logsExpanded}
            onToggleLogs={() => setLogsExpanded(!logsExpanded)}
            liveStream={liveStreams[clientSlug]}
            wsConnected={wsConnected}
          />
        )
      })}
    </div>
  )
}

function PipelineCard({
  pipeline,
  logsExpanded,
  onToggleLogs,
  liveStream,
  wsConnected,
}: {
  pipeline: AnyPipeline
  logsExpanded: boolean
  onToggleLogs: () => void
  liveStream?: LiveStream
  wsConnected: boolean
}) {
  const { loading: stepLoading, execute: executeStepRetrigger } = useAsyncAction()
  const [restarting, setRestarting] = useState<string | null>(null)

  const steps = [
    { name: 'Lint', status: pipeline.lintStatus },
    { name: 'Tests', status: pipeline.testsStatus },
    { name: 'Security', status: pipeline.securityStatus },
    { name: 'IA Risk', status: pipeline.aiRiskStatus },
    { name: 'Deploy', status: pipeline.deployStatus },
  ]

  const clientSlug = getClientSlugOf(pipeline)
  const liveLogs = liveStream?.lines ?? []
  const logsAutoScrollRef = useRef<HTMLDivElement>(null)

  const liveNormalized =
    liveStream?.status === 'in_progress' || liveStream?.status === 'queued'
      ? 'running'
      : liveStream?.status === 'completed'
        ? liveStream.conclusion === 'success'
          ? 'success'
          : liveStream.conclusion === 'failure'
            ? 'failed'
            : 'completed'
        : undefined
  const cardStatus = (liveNormalized ?? pipeline.status) as string

  useEffect(() => {
    if (logsExpanded && logsAutoScrollRef.current) {
      logsAutoScrollRef.current.scrollTop = logsAutoScrollRef.current.scrollHeight
    }
  }, [logsExpanded, liveLogs.length])

  const handleRestart = (stepName: string) => {
    setRestarting(stepName)
    executeStepRetrigger(
      () => pipelineApi.retrigger(clientSlug, pipeline.id, stepName.toLowerCase()),
      { successMessage: `Étape ${stepName} relancée` }
    ).finally(() => setRestarting(null))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="size-5 text-amber-500" />
              Pipeline en cours — {getClientName(pipeline.clientId)}
            </CardTitle>
            <CardDescription className="flex items-center gap-3 mt-1 text-xs">
              <span className="flex items-center gap-1">
                <GitCommit className="size-3" />
                {pipeline.commitHash}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="size-3" />
                {pipeline.branch}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="size-3" />
                {pipeline.trigger}
              </span>
            </CardDescription>
          </div>
          {cardStatus === 'running' && (
            <Badge variant="outline" className="w-fit gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              En cours
            </Badge>
          )}
          {cardStatus === 'success' && (
            <Badge variant="outline" className="w-fit gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
              <CircleCheck className="size-3" />
              Succès
            </Badge>
          )}
          {cardStatus === 'failed' && (
            <Badge variant="outline" className="w-fit gap-1 border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20">
              <XCircle className="size-3" />
              Échec
            </Badge>
          )}
          {(cardStatus === 'pending' || cardStatus === 'completed' || cardStatus === 'skipped') && (
            <Badge variant="outline" className="w-fit gap-1 border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/20">
              <Clock className="size-3" />
              Terminé
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PipelineTimeline
          steps={steps}
          onStepClick={(stepName) => handleRestart(stepName)}
        />

        {/* Restart step buttons */}
        <div className="flex flex-wrap gap-2">
          {steps
            .filter((s) => s.status !== 'pending')
            .map((step) => (
              <Tooltip key={step.name}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    disabled={restarting === step.name}
                    onClick={() => handleRestart(step.name)}
                  >
                    <RotateCcw className={cn('size-3', restarting === step.name && 'animate-spin')} />
                    Relancer &quot;{step.name}&quot;
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Relancer l&apos;étape {step.name} du pipeline
                </TooltipContent>
              </Tooltip>
            ))}
        </div>

        {/* Logs en direct (flux réel GitHub Actions via WebSocket) */}
        <div className="rounded-lg border bg-muted/30">
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={onToggleLogs}
          >
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Logs en direct
              {wsConnected && liveLogs.length > 0 && (
                <span className="text-[10px] font-normal text-muted-foreground">flux réel</span>
              )}
            </span>
            {logsExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {logsExpanded && (
            <div className="border-t px-4 py-3">
              <div ref={logsAutoScrollRef} className="max-h-48 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar">
                {liveLogs.length > 0 ? (
                  <>
                    {liveLogs.map((log, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-muted-foreground shrink-0">{log.time}</span>
                        <span className={cn('shrink-0 w-16', levelColors[log.level] ?? 'text-foreground')}>
                          [{log.level}]
                        </span>
                        <span className="text-foreground/80 break-all">{log.msg}</span>
                      </div>
                    ))}
                    {cardStatus === 'running' && (
                      <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                        <span className="text-emerald-500">▌</span>
                        <span>En attente de nouveaux logs...</span>
                      </div>
                    )}
                    {cardStatus !== 'running' && (
                      <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
                        <CircleCheck className="size-3 text-emerald-500" />
                        Fin du flux — {liveLogs.length} lignes
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {cardStatus === 'running' ? (
                      <>
                        <span className={cn('text-emerald-500', wsConnected && 'animate-pulse')}>▌</span>
                        {wsConnected ? (
                          <span>Pipeline en cours — les logs réels arrivent à la fin du run (GitHub Actions)</span>
                        ) : (
                          <span>Flux WebSocket indisponible (connexion au service WS en cours...)</span>
                        )}
                      </>
                    ) : (
                      <span>Logs non disponibles pour ce run</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Sécurité Pipeline Section ============
function SecuritePipeline({ clientSlug, refreshKey }: { clientSlug: string; refreshKey: number }) {
  const [cliDialogOpen, setCliDialogOpen] = useState(false)
  const [scan, setScan] = useState<SecurityScanData | null>(null)
  const [loading, setLoading] = useState(false)
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  useEffect(() => {
    if (!clientSlug) return
    queueMicrotask(() => setLoading(true))
    fetch(`/api/security/scan?client=${clientSlug}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data) setScan(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientSlug, refreshKey])

  const badgeClass = (ok: boolean) =>
    ok
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 border-0 gap-1'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100 border-0 gap-1'

  const riskLabel = scan
    ? scan.riskScore < 0.3 ? 'Faible' : scan.riskScore < 0.7 ? 'Moyen' : 'Élevé'
    : '—'

  const cliCommands = `pacadev secrets scan --all --format json
pacadev git verify-signatures --branch main
pacadev ai risk-score --threshold 0.5`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="size-5 text-emerald-600 dark:text-emerald-400" />
              Sécurité Pipeline
            </CardTitle>
            <CardDescription>
              {scan
                ? `Dernier scan CI/CD — commit ${scan.commitHash} — ${new Date(scan.scannedAt).toLocaleDateString('fr-FR')}`
                : 'État de sécurité depuis GitHub Actions'}
            </CardDescription>
          </div>
          {scan?.url && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
              <a href={scan.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" /> GitHub Actions
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement du dernier scan CI/CD…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge className={badgeClass(scan?.bandit.passed ?? true)}>
              🔒 Bandit (secrets): {scan ? (scan.bandit.passed ? 'OK' : 'ÉCHEC') : '—'}
            </Badge>
            <Badge className={badgeClass(scan?.gitleaks.passed ?? true)}>
              🛡️ Gitleaks: {scan ? (scan.gitleaks.passed ? 'OK — 0 fuite' : 'FUITE DÉTECTÉE') : '—'}
            </Badge>
            <Badge className={badgeClass((scan?.riskScore ?? 0) < 0.5)}>
              ⚡ Risk Score: {scan ? `${scan.riskScore.toFixed(2)}/1.0 (${riskLabel})` : '—'}
            </Badge>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setCurrentView('audit')}
          >
            🔐 Voir Audit Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setCliDialogOpen(true)}
          >
            📜 Voir Commande CLI
          </Button>
        </div>
      </CardContent>

      <Dialog open={cliDialogOpen} onOpenChange={setCliDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-5 text-emerald-600 dark:text-emerald-400" />
              Commande CLI équivalente
            </DialogTitle>
            <DialogDescription>
              Commandes pacadev pour lancer un scan de sécurité complet
            </DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-md border bg-zinc-950 dark:bg-zinc-900">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-1.5">
              <span className="size-2 rounded-full bg-red-500" />
              <span className="size-2 rounded-full bg-yellow-500" />
              <span className="size-2 rounded-full bg-green-500" />
              <span className="ml-2 text-[10px] font-medium text-zinc-500">Terminal</span>
            </div>
            <pre className="overflow-x-auto p-3">
              <code className="text-sm text-green-400">{cliCommands}</code>
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCliDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============ Historique Pipelines Section ============
function HistoriquePipelines({ selectedSlug }: { selectedSlug: string }) {
  const { realPipelines, realClients } = useAppStore()
  const allPipelines: AnyPipeline[] = realPipelines.length > 0 ? realPipelines : mockPipelines
  const allClients = realClients.length > 0 ? realClients : mockClients

  const getSlug = (p: AnyPipeline) =>
    ('clientSlug' in p && p.clientSlug) ? p.clientSlug : allClients.find((c) => c.id === p.clientId)?.slug ?? allClients[0]?.slug ?? ''

  const effectivePipelines = selectedSlug
    ? allPipelines.filter((p) => getSlug(p) === selectedSlug)
    : allPipelines

  const { loading: replayLoading, execute: executeReplay } = useAsyncAction()
  const { loading: exportLoading, execute: executeExport } = useAsyncAction()

  const handleReplay = (pipeline: AnyPipeline) => {
    const clientSlug = getSlug(pipeline)
    executeReplay(() => pipelineApi.retrigger(clientSlug, pipeline.id), { successMessage: 'Pipeline relancé' })
  }

  const handleExport = (pipeline: AnyPipeline) => {
    executeExport(async () => {
      const data = JSON.stringify(pipeline, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pipeline-${pipeline.id}-report.json`
      a.click()
      URL.revokeObjectURL(url)
    }, { successMessage: 'Rapport exporté' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="size-5 text-emerald-600 dark:text-emerald-400" />
          Historique pipelines
        </CardTitle>
        <CardDescription>
          {selectedSlug ? `${selectedSlug} — ` : 'Tous — '}{effectivePipelines.length} exécution(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Commit</TableHead>
                <TableHead className="text-xs">Branche</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Déclencheur</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Étapes</TableHead>
                <TableHead className="text-xs">Durée</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {effectivePipelines.map((pipeline) => (
                <TableRow key={pipeline.id}>
                  <TableCell className="font-mono text-xs">
                    {pipeline.commitHash?.slice(0, 7) ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                      <GitBranch className="size-3 text-muted-foreground" />
                      {pipeline.branch ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {pipeline.trigger === 'push' ? 'Push' : pipeline.trigger === 'manual' ? 'Manuel' : pipeline.trigger}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex gap-1">
                      {[
                        { label: 'L', status: pipeline.lintStatus },
                        { label: 'T', status: pipeline.testsStatus },
                        { label: 'S', status: pipeline.securityStatus },
                        { label: 'IA', status: pipeline.aiRiskStatus },
                        { label: 'D', status: pipeline.deployStatus },
                      ].map((step) => (
                        <StatusBadge key={step.label} status={step.status} size="sm" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDuration(pipeline.duration)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={pipeline.status} showIcon size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7"
                            disabled={replayLoading}
                            onClick={() => handleReplay(pipeline)}
                          >
                            {replayLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Replay pipeline</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7"
                            disabled={exportLoading}
                            onClick={() => handleExport(pipeline)}
                          >
                            {exportLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export rapport</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Boutons d'automatisation Section ============
function BoutonsAutomatisation() {
  const [autoMerge, setAutoMerge] = useState(false)
  const [autoDeploy, setAutoDeploy] = useState(false)
  const [autoRollback, setAutoRollback] = useState(false)
  const { loading: configLoading, execute: executeConfigUpdate } = useAsyncAction()

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/config')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.success || !d.data) return
        const cfg = d.data as { autoMerge?: boolean; autoDeploy?: boolean; autoRollback?: boolean }
        if (typeof cfg.autoMerge === 'boolean') setAutoMerge(cfg.autoMerge)
        if (typeof cfg.autoDeploy === 'boolean') setAutoDeploy(cfg.autoDeploy)
        if (typeof cfg.autoRollback === 'boolean') setAutoRollback(cfg.autoRollback)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const updateConfig = (key: string, value: boolean) => {
    const config: Record<string, unknown> = { autoMerge, autoDeploy, autoRollback, [key]: value }
    executeConfigUpdate(() => aiApi.updateConfig(config), { successMessage: 'Configuration mise à jour' })
  }

  const toggles = [
    {
      id: 'auto-merge',
      label: 'Auto-merge',
      description: 'Fusion automatique des PR quand le pipeline réussit et le risque IA est faible',
      checked: autoMerge,
      onChange: (v: boolean) => { setAutoMerge(v); updateConfig('autoMerge', v) },
      icon: GitBranch,
    },
    {
      id: 'auto-deploy',
      label: 'Auto-deploy staging',
      description: 'Déploiement automatique en staging après merge sur la branche principale',
      checked: autoDeploy,
      onChange: (v: boolean) => { setAutoDeploy(v); updateConfig('autoDeploy', v) },
      icon: Rocket,
    },
    {
      id: 'auto-rollback',
      label: 'Auto-rollback',
      description: 'Retour arrière automatique si les health checks échouent après déploiement',
      checked: autoRollback,
      onChange: (v: boolean) => { setAutoRollback(v); updateConfig('autoRollback', v) },
      icon: RotateCcw,
    },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="size-5 text-amber-600 dark:text-amber-400" />
          Automatisation
        </CardTitle>
        <CardDescription>Contrôle des actions automatiques CI/CD</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggles.map((toggle, i) => {
          const Icon = toggle.icon
          return (
            <div key={toggle.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn(
                    'flex items-center justify-center size-8 rounded-md shrink-0 mt-0.5',
                    toggle.checked
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : 'bg-muted',
                  )}>
                    <Icon className={cn(
                      'size-4',
                      toggle.checked
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor={toggle.id} className="text-sm font-medium cursor-pointer">
                      {toggle.label}
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {toggle.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={toggle.id}
                  checked={toggle.checked}
                  onCheckedChange={toggle.onChange}
                />
              </div>
              {i < toggles.length - 1 && <Separator className="mt-4" />}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ============ Gate de validation Section ============
function GateValidation({ clientSlug, refreshKey }: { clientSlug: string; refreshKey: number }) {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalEntry[]>([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)
  const [secureConfirmOpen, setSecureConfirmOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalEntry | null>(null)
  const { loading: approveLoading, execute: executeApprove } = useAsyncAction()
  const { loading: rejectLoading, execute: executeReject } = useAsyncAction()

  useEffect(() => {
    if (!clientSlug) return
    queueMicrotask(() => setLoadingApprovals(true))
    fetch(`/api/clients/${clientSlug}/deploy/approval`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPendingApprovals((d.data as ApprovalEntry[]).filter((a) => !a.used))
      })
      .catch(() => {})
      .finally(() => setLoadingApprovals(false))
  }, [clientSlug, refreshKey])

  const handleApprove = (approval: ApprovalEntry) => {
    setSelectedApproval(approval)
    setSecureConfirmOpen(true)
  }

  const handleReject = (approval: ApprovalEntry) => {
    setSelectedApproval(approval)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleSecureConfirm = (reason: string) => {
    if (!selectedApproval) return
    const env = selectedApproval.action.includes('prod') ? 'prod' : 'staging'
    executeApprove(
      () => deployApi.approve(selectedApproval.client, env, reason),
      { successMessage: 'Déploiement approuvé' }
    )
  }

  const handleRejectConfirm = () => {
    if (!selectedApproval) return
    executeReject(
      () => deployApi.approve(selectedApproval.client, 'staging', rejectReason),
      { successMessage: 'Validation rejetée' }
    )
    setRejectModalOpen(false)
    setRejectReason('')
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          Gate de validation
        </CardTitle>
        <CardDescription>
          Approbations en attente — {loadingApprovals ? '…' : `${pendingApprovals.length} requête(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingApprovals ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="size-4 animate-spin" /> Chargement des approbations…
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <ShieldCheck className="size-8 mb-2 opacity-40" />
            <p className="text-sm">Aucune approbation en attente</p>
          </div>
        ) : pendingApprovals.map((approval) => {
          const isProd = approval.action.includes('prod')
          return (
            <div
              key={approval.token.slice(0, 20)}
              className="rounded-lg border p-3 space-y-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{approval.client}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] h-5',
                    isProd
                      ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
                      : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300',
                  )}
                >
                  {isProd ? 'Production' : 'Staging'}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <GitCommit className="size-3" />
                  <span className="font-mono truncate max-w-[200px]">{approval.reason.slice(0, 60)}…</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="size-3" />
                  <span>{approval.user}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  <span>{new Date(approval.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 flex-1"
                  disabled={approveLoading}
                  onClick={() => handleApprove(approval)}
                >
                  {approveLoading ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                  Approuver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  disabled={rejectLoading}
                  onClick={() => handleReject(approval)}
                >
                  <XCircle className="size-3" />
                  Rejeter
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>

      {selectedApproval && (
        <SecureConfirmModal
          open={secureConfirmOpen}
          onOpenChange={setSecureConfirmOpen}
          title="Approuver le déploiement"
          message={`Vous allez approuver le déploiement pour ${selectedApproval.client}`}
          impact="Action critique enregistrée dans l'audit log"
          requiresReason={true}
          cliCommand={`pacadev deploy --client ${selectedApproval.client} --env ${selectedApproval.action.includes('prod') ? 'prod' : 'staging'} --approve`}
          variant="warning"
          onConfirm={handleSecureConfirm}
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-500" />
              Rejeter la validation
            </DialogTitle>
            <DialogDescription>
              Cette action sera enregistrée dans les logs d&apos;audit. Le pipeline sera bloqué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedApproval && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{selectedApproval.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action</span>
                  <span className="font-mono text-xs">{selectedApproval.action}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Motif du rejet *</Label>
              <Textarea
                id="reject-reason"
                placeholder="Expliquez pourquoi cette validation est rejetée..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============ Lien validation client Section ============
function LienValidationClient() {
  const { selectedClientSlug, realClients } = useAppStore()
  const clientSlug = selectedClientSlug && realClients.some((c) => c.slug === selectedClientSlug)
    ? selectedClientSlug
    : realClients[0]?.slug ?? ''
  const [linkGenerated, setLinkGenerated] = useState(true)
  const [linkRevoked, setLinkRevoked] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const { loading: generateLoading, execute: executeGenerate } = useAsyncAction()
  const { loading: revokeLoading, execute: executeRevoke } = useAsyncAction()

  const mockUrl = clientSlug
    ? `https://validate.enswork.local/${clientSlug}/staging/v17.2026.05.13-1?token=a8f3k2m9x1`
    : ''
  const mockExpiry = '2026-05-14T14:30:00Z'

  const handleGenerate = () => {
    if (!clientSlug) return
    executeGenerate(
      () => deployApi.generateApproval(clientSlug, 'validate', 'Génération lien validation'),
      { successMessage: 'Lien de validation généré' }
    ).then(() => {
      setLinkGenerated(true)
      setLinkRevoked(false)
    })
  }

  const handleRevoke = () => {
    if (!clientSlug) return
    executeRevoke(
      () => deployApi.generateApproval(clientSlug, 'revoke', 'Lien de validation révoqué'),
      { successMessage: 'Lien révoqué' }
    ).then(() => {
      setLinkRevoked(true)
    })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mockUrl)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          Lien validation client
        </CardTitle>
        <CardDescription>URL sécurisée pour la validation côté client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkGenerated && !linkRevoked ? (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">URL de validation</span>
                <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                  Actif
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-background px-2 py-1.5 rounded border flex-1 truncate">
                  {mockUrl}
                </code>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="size-8 shrink-0" onClick={handleCopy}>
                      <Copy className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copier le lien</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Expire le {format(new Date(mockExpiry), "dd MMM yyyy à HH:mm", { locale: fr })}
              </div>
            </div>

            {showStatus && (
              <div className="rounded-lg border p-3 space-y-2 text-xs">
                <p className="font-medium text-sm">Statut de validation</p>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>En attente de validation client</span>
                </div>
                <p className="text-muted-foreground">Dernière consultation : jamais</p>
                <p className="text-muted-foreground">Temps restant : 22h 25m</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowStatus(!showStatus)}
              >
                <Eye className="size-3.5" />
                {showStatus ? 'Masquer statut' : 'Voir statut'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                disabled={revokeLoading}
                onClick={handleRevoke}
              >
                {revokeLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                Révoquer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={generateLoading}
                onClick={handleGenerate}
              >
                {generateLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Régénérer
              </Button>
            </div>
          </>
        ) : linkRevoked ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <Ban className="size-8 mb-2 text-red-400" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Lien révoqué</p>
            <p className="text-xs mt-1">Le lien de validation n&apos;est plus accessible</p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 mt-3"
              onClick={handleGenerate}
            >
              <RefreshCw className="size-3.5" />
              Générer un nouveau lien
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <Link2 className="size-8 mb-2 opacity-40" />
            <p className="text-sm">Aucun lien généré</p>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 mt-3"
              onClick={handleGenerate}
            >
              <ExternalLink className="size-3.5" />
              Générer lien
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ Main Pipeline Module ============
export function PipelineModule() {
  const { realClients } = useAppStore()
  const clients = realClients.length > 0 ? realClients : mockClients
  const [selectedSlug, setSelectedSlug] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (clients.length > 0 && !selectedSlug) {
      queueMicrotask(() => setSelectedSlug(clients[0].slug))
    }
  }, [clients, selectedSlug])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    setTimeout(() => setRefreshing(false), 1500)
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="size-6 text-emerald-600 dark:text-emerald-400" />
            Pipeline & Déploiements
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            GitHub Actions réels — CI/CD, sécurité et gates de validation
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Sélecteur client */}
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          {/* Rafraîchir */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Section 1: Pipeline en cours */}
      <PipelineEnCours />

      {/* Section 2: Sécurité Pipeline — données GitHub Actions réelles */}
      <SecuritePipeline clientSlug={selectedSlug} refreshKey={refreshKey} />

      {/* Section 3: Historique pipelines filtré par client */}
      <HistoriquePipelines selectedSlug={selectedSlug} />

      {/* Sections 4+5: Automatisation + Gate de validation */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BoutonsAutomatisation />
        <GateValidation clientSlug={selectedSlug} refreshKey={refreshKey} />
      </div>

      {/* Section 6: Lien validation client */}
      <LienValidationClient />
    </div>
  )
}
