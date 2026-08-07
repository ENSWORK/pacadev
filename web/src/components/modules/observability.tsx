'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Cpu,
  MemoryStick,
  Database,
  Activity,
  ExternalLink,
  Search,
  Download,
  Bookmark,
  Play,
  Camera,
  Bell,
  Container,
  Shield,
  Globe,
  Server,
  RefreshCw,
  FileText,
  Zap,
  Clock,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { StatusBadge } from '@/components/shared/status-badge'
import { useAppStore } from '@/lib/store'
import type { ServiceHealth } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useWebSocket } from '@/hooks/use-websocket'
import { monitorApi, testApi } from '@/lib/api'

// Level badge color mapping
function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    DEBUG: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
    INFO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return (
    <span className={cn(
      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase',
      styles[level] ?? styles.DEBUG,
    )}>
      {level}
    </span>
  )
}

// Service type icon mapping
function ServiceTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'docker':
      return <Container className="size-4" />
    case 'tailscale':
      return <Globe className="size-4" />
    case 'db':
      return <Database className="size-4" />
    case 'traefik':
      return <Shield className="size-4" />
    default:
      return <Server className="size-4" />
  }
}

// Service status border color
function statusBorderColor(status: string): string {
  switch (status) {
    case 'up':
      return 'border-l-emerald-500'
    case 'degraded':
      return 'border-l-amber-500'
    case 'down':
      return 'border-l-red-500'
    default:
      return 'border-l-slate-400'
  }
}

// Mock alert rules
const mockAlertRules = [
  { id: 'ar_001', rule: 'CPU > 80%', threshold: '80%', channel: 'Slack', active: true },
  { id: 'ar_002', rule: 'Memory > 90%', threshold: '90%', channel: 'Slack + Email', active: true },
  { id: 'ar_003', rule: '5xx > 10/min', threshold: '10 req/min', channel: 'Slack + Email + PagerDuty', active: true },
  { id: 'ar_004', rule: 'DB down', threshold: '0 conn', channel: 'PagerDuty', active: false },
]

const serviceTypePort: Record<string, string> = {
  docker: '2375',
  traefik: '8080',
  db: '5432',
  tailscale: '41641',
}

interface ContainerMetric {
  cpu: number
  memPercent: number
  running: boolean
  timestamp: string
}

export function ObservabilityModule() {
  const { realClients } = useAppStore()
  const effectiveClients = realClients

  // Metric period
  const [metricPeriod, setMetricPeriod] = useState('1h')

  const { loading: testRunLoading, execute: executeTestRun } = useAsyncAction()
  const { loading: singleTestLoading, execute: executeSingleTest } = useAsyncAction()
  const { loading: restartLoading, execute: executeRestart } = useAsyncAction()
  const { loading: csvExportLoading, execute: executeCsvExport } = useAsyncAction()

  // Log search state
  const [logClient, setLogClient] = useState<string>('all')
  const [logModule, setLogModule] = useState<string>('all')
  const [logLevel, setLogLevel] = useState<string>('all')
  const [logSearch, setLogSearch] = useState('')
  const [liveLogEntries, setLiveLogEntries] = useState<{ timestamp: string; level: string; service: string; message: string; client?: string; module?: string }[]>([])
  const [liveStreaming, setLiveStreaming] = useState(false)

  // SSE stream for live logs when a specific client is selected
  useEffect(() => {
    if (logClient === 'all') {
      queueMicrotask(() => {
        setLiveLogEntries([])
        setLiveStreaming(false)
      })
      return
    }
    queueMicrotask(() => {
      setLiveLogEntries([])
      setLiveStreaming(true)
    })
    const es = new EventSource(`/api/clients/${logClient}/logs/stream?lines=50`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'log') {
          setLiveLogEntries((prev) => [
            { timestamp: data.timestamp, level: data.level as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', service: 'odoo', message: data.message, client: data.client },
            ...prev.slice(0, 199),
          ])
        }
      } catch { /* skip malformed */ }
    }
    es.onerror = () => setLiveStreaming(false)
    return () => {
      es.close()
      setLiveStreaming(false)
    }
  }, [logClient])

  // Alert rules
  const [alertRules, setAlertRules] = useState(mockAlertRules)

  // Scroll ref
  const logEndRef = useRef<HTMLDivElement>(null)

  // Filter logs — derived from state, no effect needed
  const filteredLogs = useMemo(() => {
    let results = [...liveLogEntries]

    if (logClient !== 'all') {
      results = results.filter((l) => l.client === logClient)
    }
    if (logModule !== 'all') {
      results = results.filter((l) => l.module === logModule || (logModule === 'none' && !l.module))
    }
    if (logLevel !== 'all') {
      results = results.filter((l) => l.level === logLevel)
    }
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase()
      results = results.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.service.toLowerCase().includes(q)
      )
    }

    return results
  }, [logClient, logModule, logLevel, logSearch, liveLogEntries])

  const handleSearch = useCallback(() => {
    // Handled by useMemo — kept for manual search button compatibility
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredLogs])

  const toggleAlertRule = useCallback((id: string) => {
    setAlertRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    )
  }, [])

  // Real services
  const [realServices, setRealServices] = useState<ServiceHealth[]>([])
  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => { if (d.success) setRealServices(d.data) }).catch(() => {})
  }, [])

  // Métriques conteneurs Docker (temps réel via WebSocket port 3003)
  const [containerMetrics, setContainerMetrics] = useState<Record<string, ContainerMetric>>({})
  const { connected: wsConnected, subscribe } = useWebSocket()

  useEffect(() => {
    const offMetrics = subscribe('metrics:update', (data) => {
      const d = data as { client?: string; cpu?: number; memPercent?: number; containerRunning?: boolean; timestamp?: string }
      if (!d?.client) return
      setContainerMetrics((prev) => ({
        ...prev,
        [d.client!]: {
          cpu: d.cpu ?? 0,
          memPercent: d.memPercent ?? 0,
          running: !!d.containerRunning,
          timestamp: d.timestamp ?? '',
        },
      }))
    })
    return offMetrics
  }, [subscribe])

  // Smoke tests state (no automation yet)
  const smokeTests: { id: string; name: string; status: string; duration: number; lastRun: string }[] = []
  const passedTests = 0
  const totalTests = 0

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Observabilité & Logs</h2>
        <p className="text-muted-foreground">
          Supervision infrastructure, recherche de logs, alertes et santé des services.
        </p>
      </div>

      {/* Section 1: Métriques système */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="size-5" />
            Métriques système
          </h3>
          <ToggleGroup
            type="single"
            value={metricPeriod}
            onValueChange={(v) => v && setMetricPeriod(v)}
            className="gap-1"
          >
            <ToggleGroupItem value="1h" className="text-xs h-7 px-2.5">1h</ToggleGroupItem>
            <ToggleGroupItem value="6h" className="text-xs h-7 px-2.5">6h</ToggleGroupItem>
            <ToggleGroupItem value="24h" className="text-xs h-7 px-2.5">24h</ToggleGroupItem>
            <ToggleGroupItem value="7d" className="text-xs h-7 px-2.5">7d</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* CPU */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="size-4 text-emerald-600" />
                  CPU Usage
                </div>
                <span className="text-2xl font-bold">45%</span>
              </div>
              <Progress value={45} className="h-1.5" />
              <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => window.open('https://grafana.enswork.local/d/cpu-dashboard', '_blank')}>
                <ExternalLink className="size-3 mr-1" />
                Voir dans Grafana
              </Button>
            </CardContent>
          </Card>

          {/* Memory */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MemoryStick className="size-4 text-amber-600" />
                  Memory Usage
                </div>
                <span className="text-2xl font-bold text-amber-600">72%</span>
              </div>
              <Progress value={72} className="h-1.5 [&>div]:bg-amber-500" />
              <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => window.open('https://grafana.enswork.local/d/memory-dashboard', '_blank')}>
                <ExternalLink className="size-3 mr-1" />
                Voir dans Grafana
              </Button>
            </CardContent>
          </Card>

          {/* DB Connections */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="size-4 text-emerald-600" />
                  DB Connections
                </div>
                <span className="text-2xl font-bold">
                  23<span className="text-sm font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <Progress value={23} className="h-1.5" />
              <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => window.open('https://grafana.enswork.local/d/db-dashboard', '_blank')}>
                <ExternalLink className="size-3 mr-1" />
                Voir dans Grafana
              </Button>
            </CardContent>
          </Card>

          {/* Request Rate */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="size-4 text-emerald-600" />
                  Request Rate
                </div>
                <span className="text-2xl font-bold">
                  142<span className="text-sm font-normal text-muted-foreground"> req/min</span>
                </span>
              </div>
              <Progress value={57} className="h-1.5" />
              <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => window.open('https://grafana.enswork.local/d/requests-dashboard', '_blank')}>
                <ExternalLink className="size-3 mr-1" />
                Voir dans Grafana
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 1b: Métriques conteneurs (temps réel Docker) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Container className="size-5" />
            Métriques conteneurs (Docker temps réel)
          </h3>
          {wsConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
              WS hors ligne
            </span>
          )}
        </div>
        {Object.keys(containerMetrics).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            {wsConnected
              ? 'En attente des métriques Docker (cycle 10s)...'
              : 'Connexion au service WebSocket (port 3003) en cours...'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(containerMetrics).map(([slug, m]) => (
              <Card key={slug}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Container className={cn('size-4', m.running ? 'text-emerald-600' : 'text-red-500')} />
                      {slug}
                    </div>
                    <Badge variant="outline" className={cn('text-[10px]', m.running ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300' : 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400')}>
                      {m.running ? 'actif' : 'arrêté'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Cpu className="size-3" />
                        CPU
                      </div>
                      <span className="text-xl font-bold">{m.cpu.toFixed(1)}%</span>
                      <Progress value={Math.min(m.cpu, 100)} className="mt-1 h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MemoryStick className="size-3" />
                        Mémoire
                      </div>
                      <span className="text-xl font-bold">{m.memPercent.toFixed(1)}%</span>
                      <Progress value={Math.min(m.memPercent, 100)} className="mt-1 h-1.5" />
                    </div>
                  </div>
                  {m.timestamp && (
                    <div className="text-[10px] text-muted-foreground">
                      Dernière mesure : {format(new Date(m.timestamp), 'HH:mm:ss')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Recherche logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            Recherche logs
            {liveStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Interface de recherche Kibana-lite — filtrez et explorez les logs système
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client</label>
              <Select value={logClient} onValueChange={setLogClient}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {effectiveClients.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Module</label>
              <Select value={logModule} onValueChange={setLogModule}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="web">web</SelectItem>
                  <SelectItem value="sale">sale</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Niveau</label>
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="DEBUG">DEBUG</SelectItem>
                  <SelectItem value="INFO">INFO</SelectItem>
                  <SelectItem value="WARNING">WARNING</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Recherche</label>
              <Input
                placeholder="Recherche plein texte..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSearch}>
                <Search className="size-3.5 mr-1.5" />
                Rechercher
              </Button>
              <Button variant="outline" size="sm">
                <Bookmark className="size-3.5 mr-1.5" />
                Sauvegarder
              </Button>
              <Button variant="outline" size="sm" disabled={csvExportLoading} onClick={() => executeCsvExport(async () => { const csvContent = [Object.keys(filteredLogs[0] ?? {}).join(','), ...filteredLogs.map(l => Object.values(l).join(','))].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'logs-export.csv'; a.click(); URL.revokeObjectURL(url) }, { successMessage: 'CSV exporté' })}>
                <Download className="size-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>

          {/* Log results table */}
          <ScrollArea className="max-h-80 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[80px]">Level</TableHead>
                  <TableHead className="w-[100px]">Service</TableHead>
                  <TableHead className="w-[120px]">Client</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.timestamp), 'dd/MM HH:mm:ss.SSS')}
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={log.level} />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.service}</TableCell>
                    <TableCell className="text-sm">
                      {log.client ? (
                        <Badge variant="outline" className="text-[10px]">{log.client}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[400px]">
                      {log.message}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun log trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div ref={logEndRef} />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bottom row: Smoke tests + Alertes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 3: Smoke tests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5" />
                  Smoke tests
                </CardTitle>
                <CardDescription>
                  Résultats des tests de validation automatique
                </CardDescription>
              </div>
              <Badge
                className={cn(
                  'text-xs',
                  passedTests === totalTests
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                )}
              >
                {passedTests}/{totalTests} passés
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Dernière exécution</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smokeTests.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Aucun test automatisé configuré</TableCell></TableRow>
                )}
                {smokeTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium text-sm">{test.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={test.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(test.duration / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(test.lastRun), 'dd/MM HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="size-7 p-0" title="Relancer" disabled={singleTestLoading} onClick={() => executeSingleTest(() => testApi.run('acmecorp', test.name), { successMessage: `Test ${test.name} lancé` })}>
                          <RefreshCw className="size-3.5" />
                        </Button>
                        {test.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="size-7 p-0" title="Voir capture">
                            <Camera className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" className="w-full" disabled={testRunLoading} onClick={() => executeTestRun(() => testApi.run('acmecorp', 'all'), { successMessage: 'Tous les tests lancés' })}>
              {testRunLoading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
              Lancer tous les tests
            </Button>
          </CardContent>
        </Card>

        {/* Section 4: Alertes configurées */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5" />
              Alertes configurées
            </CardTitle>
            <CardDescription>
              Règles d&apos;alerte Prometheus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Règle</TableHead>
                  <TableHead>Seuil</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium text-sm">{rule.rule}</TableCell>
                    <TableCell className="text-sm font-mono">{rule.threshold}</TableCell>
                    <TableCell className="text-sm">{rule.channel}</TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.active}
                        onCheckedChange={() => toggleAlertRule(rule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleAlertRule(rule.id)}>
                          Éditer seuil
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleAlertRule(rule.id)}>
                          Tester
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => toggleAlertRule(rule.id)}
                        >
                          Désactiver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Santé services */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="size-5" />
          Santé services
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {realServices.length === 0 && (
            <div className="col-span-3 text-center text-sm text-muted-foreground py-8">Chargement des services...</div>
          )}
          {realServices.map((service) => (
            <Card
              key={service.id}
              className={cn('border-l-4', statusBorderColor(service.status))}
            >
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ServiceTypeIcon type={service.type} />
                    <span className="font-medium text-sm">{service.name}</span>
                  </div>
                  <StatusBadge status={service.status} size="sm" showIcon />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">URL</span>
                    <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                      {service.url ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Latence</span>
                    <span className={cn(
                      'font-medium',
                      service.status === 'degraded'
                        ? 'text-amber-600'
                        : 'text-emerald-600',
                    )}>
                      —
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Port</span>
                    <span className="font-mono">{serviceTypePort[service.type] ?? '—'}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" disabled={restartLoading} onClick={() => executeRestart(() => monitorApi.restartService('acmecorp', service.name), { successMessage: `${service.name} redémarré` })}>
                    <RefreshCw className="size-3 mr-1" />
                    Redémarrer
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => executeSingleTest(() => monitorApi.logs(service.name), { successMessage: `Logs de ${service.name} chargés` })}>
                    <FileText className="size-3 mr-1" />
                    Voir logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
