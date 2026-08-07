'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Activity,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Radio,
  Shield,
  X,
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AuditTable } from '@/components/shared/audit-table'
import { useAppStore } from '@/lib/store'
import { auditApi } from '@/lib/api'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useWebSocket } from '@/hooks/use-websocket'
import { cn } from '@/lib/utils'
import type { AuditLog } from '@/lib/types'

// ─── Live stream entry type ─────────────────────────────────────────────────
interface LiveStreamEntry {
  id: string
  time: string
  user: string
  action: 'deploy' | 'approve' | 'create' | 'security' | 'rollback'
  message: string
}

// ─── Border color by action type ────────────────────────────────────────────
const streamActionBorder: Record<string, string> = {
  deploy: 'border-l-emerald-500',
  approve: 'border-l-blue-500',
  create: 'border-l-slate-400',
  security: 'border-l-red-500',
  rollback: 'border-l-orange-500',
}

const streamActionDot: Record<string, string> = {
  deploy: 'bg-emerald-500',
  approve: 'bg-blue-500',
  create: 'bg-slate-400',
  security: 'bg-red-500',
  rollback: 'bg-orange-500',
}

const streamActionLabel: Record<string, string> = {
  deploy: 'Déploiement',
  approve: 'Approbation',
  create: 'Création',
  security: 'Sécurité',
  rollback: 'Rollback',
}

// ─── Real audit log → stream entry converters ────────────────────────────────
const ACTION_VERB: Record<string, string> = {
  deploy: 'a déployé',
  rollback: 'a rollback',
  approve: 'a approuvé',
  work_start: 'a démarré le travail sur',
  backup: 'a créé un backup de',
  ai_config: 'a configuré l\'IA pour',
  acknowledge_alert: 'a acquitté une alerte sur',
  create: 'a créé',
  delete: 'a supprimé',
}

function mapAction(action: string): LiveStreamEntry['action'] {
  if (action === 'deploy') return 'deploy'
  if (action === 'rollback') return 'rollback'
  if (action === 'approve') return 'approve'
  if (action === 'delete') return 'security'
  return 'create'
}

function toStreamEntry(log: AuditLog): LiveStreamEntry {
  const d = new Date(log.createdAt)
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const verb = ACTION_VERB[log.action] ?? log.action
  const clientPart = log.client ? ` ${log.client}` : ''
  const detailsPart = log.details ? ` — ${log.details}` : ''
  return {
    id: log.id,
    time,
    user: log.user,
    action: mapAction(log.action),
    message: `${log.user} ${verb}${clientPart}${detailsPart}`,
  }
}

// ─── Raw audit entries (WebSocket audit:snapshot / audit:new) ───────────────
interface WsAuditEntry {
  id?: string
  ts?: string
  timestamp?: string
  action?: string
  client?: string
  issue?: number
  branch?: string
  module?: string | null
  user?: string
  details?: string
}

function toWsStreamEntry(entry: WsAuditEntry): LiveStreamEntry {
  const raw = entry.ts ?? entry.timestamp ?? new Date().toISOString()
  const d = new Date(raw)
  const time = Number.isNaN(d.getTime())
    ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const verb = ACTION_VERB[entry.action ?? ''] ?? (entry.action ?? 'action')
  const clientPart = entry.client ? ` ${entry.client}` : ''
  let detailsPart = ''
  if (entry.details) detailsPart = ` — ${entry.details}`
  else if (entry.branch) detailsPart = ` — Branch: ${entry.branch}`
  else if (entry.module) detailsPart = ` — Module: ${entry.module}`
  else if (entry.issue) detailsPart = ` — Issue #${entry.issue}`
  const user = entry.user ?? 'system'
  return {
    id: entry.id ?? `${raw}_${Math.random().toString(36).substring(2, 7)}`,
    time,
    user,
    action: mapAction(entry.action ?? 'create'),
    message: `${user} ${verb}${clientPart}${detailsPart}`,
  }
}

// ─── Action types for the multi-select filter ───────────────────────────────
const ACTION_TYPES = [
  'deploy',
  'rollback',
  'approve',
  'create',
  'delete',
  'ai_config',
  'backup',
  'acknowledge_alert',
] as const

// ─── Severity mapping (inferred from action type) ──────────────────────────
const actionSeverity: Record<string, string> = {
  deploy: 'info',
  rollback: 'warning',
  approve: 'info',
  create: 'info',
  delete: 'critical',
  ai_config: 'info',
  backup: 'info',
  acknowledge_alert: 'info',
}

// ─── Unique users from audit logs ───────────────────────────────────────────
function getUniqueUsers(logs: AuditLog[]): string[] {
  return [...new Set(logs.map((l) => l.user))].sort()
}

// ─── Export helpers ─────────────────────────────────────────────────────────
function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

function exportToPDF(logs: AuditLog[]) {
  // Generate a simple text-based PDF-like document as a blob
  const lines = [
    'PACADEV - Rapport d\'audit',
    `Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    `Nombre d'entrées: ${logs.length}`,
    '',
    '─'.repeat(120),
    '',
    ...logs.map((l) => {
      const date = typeof l.createdAt === 'string'
        ? new Date(l.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—'
      return `[${date}] ${l.user} | ${l.action.toUpperCase()} | ${(l.client ?? '—')} | ${(l.details ?? '')} | ${(l.reason ?? '')}`
    }),
  ]
  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, `audit-report-${new Date().toISOString().split('T')[0]}.txt`)
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Audit Module Component
// ═══════════════════════════════════════════════════════════════════════════════
export function AuditModule() {
  const { userRole, realClients } = useAppStore()
  const isAdmin = userRole === 'admin'

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  useEffect(() => {
    fetch('/api/audit')
      .then((r) => r.json())
      .then((d) => { if (d.success) setAuditLogs(d.data) })
      .catch(() => {})
  }, [])

  // ── Live stream state ──
  const [liveEnabled, setLiveEnabled] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derived from real audit logs (most recent 50)
  const streamEntries = useMemo(
    () => auditLogs.slice(-50).map(toStreamEntry),
    [auditLogs],
  )

  // ── Live WebSocket audit stream (port 3003) ──
  const [wsLiveEntries, setWsLiveEntries] = useState<LiveStreamEntry[]>([])
  const { connected: wsConnected, subscribe } = useWebSocket()

  useEffect(() => {
    if (!liveEnabled) return
    const offSnapshot = subscribe('audit:snapshot', (data) => {
      const d = data as { logs?: WsAuditEntry[] }
      if (!Array.isArray(d?.logs)) return
      const entries = d.logs.map(toWsStreamEntry).reverse()
      setWsLiveEntries((prev) => {
        const ids = new Set(entries.map((e) => e.id))
        return [...entries, ...prev.filter((e) => !ids.has(e.id))].slice(0, 50)
      })
    })
    const offNew = subscribe('audit:new', (data) => {
      const d = data as WsAuditEntry
      if (!d || !d.action) return
      const entry = toWsStreamEntry(d)
      setWsLiveEntries((prev) => {
        const ids = new Set(prev.map((e) => e.id))
        if (ids.has(entry.id)) return prev
        return [entry, ...prev].slice(0, 50)
      })
    })
    return () => {
      offSnapshot()
      offNew()
    }
  }, [subscribe, liveEnabled])

  const displayStream = useMemo(() => {
    if (liveEnabled && wsConnected && wsLiveEntries.length > 0) return wsLiveEntries
    return [...streamEntries].reverse()
  }, [liveEnabled, wsConnected, wsLiveEntries, streamEntries])

  // ── Table filter state ──
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [selectedActionTypes, setSelectedActionTypes] = useState<Set<string>>(new Set())

  // ── Export async actions ──
  const { loading: csvExportLoading, execute: executeCsvExport } = useAsyncAction()
  const { loading: jsonExportLoading, execute: executeJsonExport } = useAsyncAction()
  const { loading: pdfExportLoading, execute: executePdfExport } = useAsyncAction()

  // ── Derived data ──
  const uniqueUsers = useMemo(() => getUniqueUsers(auditLogs), [auditLogs])

  // ── Filtered logs for the table ──
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // User filter
      if (filterUser !== 'all' && log.user !== filterUser) return false

      // Client filter
      if (filterClient !== 'all' && log.client !== filterClient) return false

      // Action type filter (multi-select)
      if (selectedActionTypes.size > 0 && !selectedActionTypes.has(log.action)) return false

      // Date range filter
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom)
        if (new Date(log.createdAt) < fromDate) return false
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo)
        // Include the entire "to" day
        toDate.setHours(23, 59, 59, 999)
        if (new Date(log.createdAt) > toDate) return false
      }

      // Severity filter
      if (filterSeverity !== 'all') {
        const logSeverity = actionSeverity[log.action] ?? 'info'
        if (logSeverity !== filterSeverity) return false
      }

      return true
    })
  }, [auditLogs, filterUser, filterClient, selectedActionTypes, filterDateFrom, filterDateTo, filterSeverity])

  // ── Live polling — refresh real audit logs every 15s ──
  useEffect(() => {
    if (!liveEnabled) return
    intervalRef.current = setInterval(() => {
      fetch('/api/audit')
        .then((r) => r.json())
        .then((d) => { if (d.success) setAuditLogs(d.data) })
        .catch(() => {})
    }, 15000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [liveEnabled])


  // ── Action type toggle ──
  const toggleActionType = useCallback((action: string) => {
    setSelectedActionTypes((prev) => {
      const next = new Set(prev)
      if (next.has(action)) {
        next.delete(action)
      } else {
        next.add(action)
      }
      return next
    })
  }, [])

  // ── Clear all filters ──
  const clearFilters = useCallback(() => {
    setFilterUser('all')
    setFilterClient('all')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterSeverity('all')
    setSelectedActionTypes(new Set())
  }, [])

  const hasActiveFilters =
    filterUser !== 'all' ||
    filterClient !== 'all' ||
    filterDateFrom !== '' ||
    filterDateTo !== '' ||
    filterSeverity !== 'all' ||
    selectedActionTypes.size > 0

  // ── Export handlers ──
  const handleExportCSV = useCallback(() => {
    executeCsvExport(async () => {
      const params = new URLSearchParams()
      if (filterUser !== 'all') params.set('user', filterUser)
      if (filterClient !== 'all') params.set('client', filterClient)
      if (selectedActionTypes.size === 1) params.set('action', [...selectedActionTypes][0])
      if (filterDateFrom) params.set('from', filterDateFrom)
      if (filterDateTo) params.set('to', filterDateTo)
      const qs = params.toString()
      const url = `/api/audit/export?format=csv${qs ? `&${qs}` : ''}`
      downloadFile(url, `audit-${new Date().toISOString().split('T')[0]}.csv`)
    }, { successMessage: 'Export CSV téléchargé' })
  }, [filterUser, filterClient, selectedActionTypes, filterDateFrom, filterDateTo, executeCsvExport])

  const handleExportJSON = useCallback(() => {
    executeJsonExport(async () => {
      const params = new URLSearchParams()
      if (filterUser !== 'all') params.set('user', filterUser)
      if (filterClient !== 'all') params.set('client', filterClient)
      if (selectedActionTypes.size === 1) params.set('action', [...selectedActionTypes][0])
      if (filterDateFrom) params.set('from', filterDateFrom)
      if (filterDateTo) params.set('to', filterDateTo)
      const qs = params.toString()
      const url = `/api/audit/export?format=json${qs ? `&${qs}` : ''}`
      downloadFile(url, `audit-${new Date().toISOString().split('T')[0]}.json`)
    }, { successMessage: 'Export JSON téléchargé' })
  }, [filterUser, filterClient, selectedActionTypes, filterDateFrom, filterDateTo, executeJsonExport])

  const handleExportPDF = useCallback(() => {
    executePdfExport(async () => {
      exportToPDF(filteredLogs)
    }, { successMessage: 'Rapport PDF téléchargé' })
  }, [filteredLogs, executePdfExport])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h2>
        <p className="text-muted-foreground">
          Traçabilité complète des actions — déploiements, approbations, alertes et sécurité.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Section 1: Live Audit Stream
          ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-5" />
                Flux en direct
              </CardTitle>
              <CardDescription>
                Événements d&apos;audit en temps réel
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="live-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                {liveEnabled && (
                  <span className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                  </span>
                )}
                Temps réel
              </Label>
              <Switch
                id="live-toggle"
                checked={liveEnabled}
                onCheckedChange={setLiveEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded-md border">
            <div className="divide-y divide-border">
              {displayStream.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  Aucun événement dans le journal d&apos;audit
                </div>
              )}
              {displayStream.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2 border-l-4 transition-colors hover:bg-muted/50',
                    streamActionBorder[entry.action] ?? 'border-l-slate-400',
                  )}
                >
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap pt-0.5 min-w-[70px]">
                    {entry.time}
                  </span>
                  <span className={cn('mt-1.5 size-2 rounded-full shrink-0', streamActionDot[entry.action] ?? 'bg-slate-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate">{entry.message}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-5 shrink-0',
                      entry.action === 'deploy' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                      entry.action === 'approve' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                      entry.action === 'create' && 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
                      entry.action === 'security' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      entry.action === 'rollback' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                    )}
                  >
                    {streamActionLabel[entry.action] ?? entry.action}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{displayStream.length} événements</span>
            <span className="flex items-center gap-2">
              {wsConnected && liveEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  WebSocket temps réel
                </span>
              )}
              {!liveEnabled && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Flux en pause</span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Section 2: Full Audit Table with Filters
          ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Journal complet
          </CardTitle>
          <CardDescription>
            Historique détaillé de toutes les actions avec filtres avancés
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Filters bar ── */}
          <div className="space-y-4">
            {/* Row 1: User, Client, Severity */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Utilisateur</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {uniqueUsers.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Client</Label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    {realClients.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sévérité</Label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date range */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Date début</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-[170px] h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Date fin</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-[170px] h-9"
                />
              </div>
            </div>

            {/* Row 3: Action type multi-select */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="size-3" />
                Type d&apos;action
              </Label>
              <div className="flex flex-wrap gap-2">
                {ACTION_TYPES.map((action) => (
                  <label
                    key={action}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                      selectedActionTypes.has(action)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <Checkbox
                      checked={selectedActionTypes.has(action)}
                      onCheckedChange={() => toggleActionType(action)}
                      className="size-3"
                    />
                    {action}
                  </label>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={clearFilters}>
                  <X className="size-3" />
                  Réinitialiser les filtres
                </Button>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-xs text-muted-foreground">
                  {filteredLogs.length} entrée{filteredLogs.length !== 1 ? 's' : ''} filtrée{filteredLogs.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Audit Table ── */}
          <AuditTable logs={filteredLogs} />
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Section 3: Export
          ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Export des données
          </CardTitle>
          <CardDescription>
            Téléchargez le journal d&apos;audit filtré dans différents formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={csvExportLoading || filteredLogs.length === 0}
                onClick={handleExportCSV}
              >
                {csvExportLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                Exporter CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={jsonExportLoading || filteredLogs.length === 0}
                onClick={handleExportJSON}
              >
                {jsonExportLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileJson className="size-4" />
                )}
                Exporter JSON
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={pdfExportLoading || filteredLogs.length === 0}
                onClick={handleExportPDF}
              >
                {pdfExportLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Exporter PDF
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredLogs.length}</span>{' '}
              entrée{filteredLogs.length !== 1 ? 's' : ''} à exporter
            </span>

            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                Filtres actifs
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
