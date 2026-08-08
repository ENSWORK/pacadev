'use client'

import { useMemo, useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Users,
  Rocket,
  AlertTriangle,
  Brain,
  RefreshCw,
  Loader2,
  Container,
  Network,
  Database,
  Globe,
  ArrowRight,
  Eye,
  RotateCcw,
  ShieldCheck,
  ExternalLink,
  Ticket,
  MessageSquare,
  Laptop,
  Terminal,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DashboardStats, Deployment, Alert, ServiceHealth } from '@/lib/types'
import { useAppStore } from '@/lib/store'
import type { ServiceType } from '@/lib/types'
import { useAsyncAction } from '@/hooks/use-async-action'
import { pipelineApi, rollbackApi } from '@/lib/api'

// ── Service type icon map ─────────────────────────────────────────────────
const serviceIcons: Record<ServiceType, React.ElementType> = {
  docker: Container,
  tailscale: Network,
  db: Database,
  traefik: Globe,
}

const serviceTypeLabels: Record<ServiceType, string> = {
  docker: 'Docker',
  tailscale: 'Tailscale',
  db: 'Base de données',
  traefik: 'Proxy',
}

// ── Stat card colors ──────────────────────────────────────────────────────
const statConfig = {
  clients: { icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  deploys: { icon: Rocket, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  alerts: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  ia: { icon: Brain, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
} as const

// ── Alert level emoji ─────────────────────────────────────────────────────
const alertEmoji: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

type DashData = { stats: DashboardStats; recentDeployments: Deployment[]; activeAlerts: Alert[] }

// ── Main Dashboard ────────────────────────────────────────────────────────
export function DashboardGlobal() {
  const { setSelectedClientSlug, setCurrentView, realClients, realTickets } = useAppStore()
  const effectiveClients = realClients
  const effectiveTickets = realTickets

  const [dashData, setDashData] = useState<DashData | null>(null)
  const [realServices, setRealServices] = useState<ServiceHealth[]>([])
  const [logsService, setLogsService] = useState<string | null>(null)
  const [serviceLogs, setServiceLogs] = useState<{ timestamp: string; message: string }[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadServiceLogs = (service: string) => {
    setLogsService(service)
    setServiceLogs([])
    setLogsLoading(true)
    fetch(`/api/services/logs?service=${encodeURIComponent(service)}&limit=150`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setServiceLogs(d.data.logs ?? []) })
      .catch(() => setServiceLogs([]))
      .finally(() => setLogsLoading(false))
  }

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { if (d.success) setDashData(d.data) })
      .catch(() => {})
    fetch('/api/services')
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data.length > 0) setRealServices(d.data) })
      .catch(() => {})
  }, [])

  const { loading: refreshLoading, execute: executeRefresh } = useAsyncAction()
  const { loading: retriggerLoading, execute: executeRetrigger } = useAsyncAction()
  const { loading: rollbackLoading, execute: executeRollback } = useAsyncAction()
  const { loading: ackLoading, execute: executeAck } = useAsyncAction()

  const stats = useMemo(() => {
    const byStatus = {
      dev: effectiveClients.filter((c) => c.status === 'dev').length,
      staging: effectiveClients.filter((c) => c.status === 'staging').length,
      prod: effectiveClients.filter((c) => c.status === 'prod').length,
    }
    return {
      byStatus,
      totalClients: effectiveClients.length,
      activeDeployments: dashData?.stats.activeDeployments ?? 0,
      criticalAlerts: dashData?.stats.criticalAlerts ?? 0,
      iaTokensUsed: dashData?.stats.iaTokensUsed ?? 0,
      iaCostEstimated: dashData?.stats.iaCostEstimated ?? 0,
      servicesUp: dashData?.stats.servicesUp ?? 0,
      servicesTotal: dashData?.stats.servicesTotal ?? 0,
    }
  }, [effectiveClients, dashData])

  const activeAlerts = dashData?.activeAlerts.filter((a) => a.status === 'active') ?? []
  const recentDeploys = dashData?.recentDeployments ?? []

  // id → name  (pour alertes/déploiements dont clientId = id ou slug)
  const clientNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    effectiveClients.forEach((c) => {
      m[c.id] = c.name
      m[c.slug] = c.name
    })
    return m
  }, [effectiveClients])

  // id → slug
  const clientSlugMap = useMemo(() => {
    const m: Record<string, string> = {}
    effectiveClients.forEach((c) => {
      m[c.id] = c.slug
      m[c.slug] = c.slug
    })
    return m
  }, [effectiveClients])

  const safeFormatDate = (val: Date | string | null | undefined) => {
    if (!val) return null
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  const formatDuration = (start: Date | string, end: Date | string | null) => {
    if (!end) return '—'
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ── Section 1: Stats Cards Row ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Clients actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clients actifs
            </CardTitle>
            <CardAction>
              <div className={`flex size-9 items-center justify-center rounded-lg ${statConfig.clients.bg}`}>
                <statConfig.clients.icon className={`size-4 ${statConfig.clients.color}`} />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="-mt-2">
            <p className="text-2xl font-bold">{stats.totalClients}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] px-1.5 py-0 h-4">
                Prod: {stats.byStatus.prod}
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0 h-4">
                Staging: {stats.byStatus.staging}
              </Badge>
              <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300 text-[10px] px-1.5 py-0 h-4">
                Dev: {stats.byStatus.dev}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Déploiements actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Déploiements actifs
            </CardTitle>
            <CardAction>
              <div className={`flex size-9 items-center justify-center rounded-lg ${statConfig.deploys.bg}`}>
                <statConfig.deploys.icon className={`size-4 ${statConfig.deploys.color}`} />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="-mt-2">
            <p className="text-2xl font-bold">{stats.activeDeployments}</p>
            <p className="text-xs text-muted-foreground mt-1">En cours d&apos;exécution</p>
          </CardContent>
        </Card>

        {/* Alertes critiques */}
        <Card className={stats.criticalAlerts > 0 ? 'border-red-200 dark:border-red-800/50' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alertes critiques
            </CardTitle>
            <CardAction>
              <div className={`flex size-9 items-center justify-center rounded-lg ${statConfig.alerts.bg}`}>
                <statConfig.alerts.icon className={`size-4 ${statConfig.alerts.color}`} />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="-mt-2">
            <p className={`text-2xl font-bold ${stats.criticalAlerts > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {stats.criticalAlerts}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.criticalAlerts > 0 ? 'Attention requise' : 'Aucune alerte'}
            </p>
          </CardContent>
        </Card>

        {/* Consommation IA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consommation IA
            </CardTitle>
            <CardAction>
              <div className={`flex size-9 items-center justify-center rounded-lg ${statConfig.ia.bg}`}>
                <statConfig.ia.icon className={`size-4 ${statConfig.ia.color}`} />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="-mt-2">
            <p className="text-2xl font-bold">{(stats.iaTokensUsed / 1000).toFixed(0)}k</p>
            <p className="text-xs text-muted-foreground mt-1">tokens — {stats.iaCostEstimated.toFixed(2)}&euro; estimé</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Mes Tickets Actifs ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-amber-600 dark:text-amber-400" />
            Mes tickets actifs
          </CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCurrentView('workspace')}>
              <Ticket className="size-3.5" />
              Nouveau Ticket
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(effectiveTickets).flatMap(([slug, tickets]) => tickets.filter((t) => t.status !== 'closed')).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun ticket actif</p>
            )}
            {Object.entries(effectiveTickets).flatMap(([slug, tickets]) =>
              tickets
                .filter((t) => t.status !== 'closed')
                .map((ticket) => {
                  const client = effectiveClients.find((c) => c.slug === slug)
                  const statusColor = ticket.status === 'in_progress'
                    ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20'
                  const statusIcon = ticket.status === 'in_progress' ? '🟡' : '🔵'

                  return (
                    <div
                      key={`${slug}-${ticket.id}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${statusColor}`}
                    >
                      <span className="text-sm shrink-0 mt-0.5">{statusIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
                          <p className="text-sm font-medium truncate">{ticket.title}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                          {client && <span>{client.name}</span>}
                          <span>&middot;</span>
                          <span>{ticket.assignee ?? 'Non assigné'}</span>
                          <span>&middot;</span>
                          <span>{safeFormatDate(ticket.updatedAt) ? formatDistanceToNow(safeFormatDate(ticket.updatedAt)!, { addSuffix: true, locale: fr }) : '—'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {ticket.labels.map((label) => (
                            <Badge key={label} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setCurrentView('workspace') }}>
                              <Laptop className="size-3" />
                              <span className="hidden lg:inline">Reprendre</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reprendre le développement</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setSelectedClientSlug(slug); setCurrentView('workspace') }}>
                              <MessageSquare className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ajouter un commentaire</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3 & 4: Infrastructure + Deployments ─────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Santé Infrastructure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              Santé Infrastructure
            </CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={refreshLoading} onClick={() => executeRefresh(() => fetch('/api/services').then((r) => r.json()).then((d) => { if (d.success) setRealServices(d.data); return d }), { successMessage: 'Santé rafraîchie' })}>
                {refreshLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Rafraîchir
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {realServices.map((svc) => {
                const Icon = serviceIcons[svc.type] ?? Container
                const statusColor = svc.status === 'up'
                  ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : svc.status === 'degraded'
                    ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'

                return (
                  <div
                    key={svc.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${statusColor}`}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{svc.name}</p>
                        <StatusBadge status={svc.status} size="sm" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {serviceTypeLabels[svc.type]}{safeFormatDate(svc.lastCheck) ? ` · Vérifié ${formatDistanceToNow(safeFormatDate(svc.lastCheck)!, { addSuffix: true, locale: fr })}` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2 text-xs" onClick={() => loadServiceLogs(svc.name)}>
                      Voir logs
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Déploiements récents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-4 text-amber-600 dark:text-amber-400" />
              Déploiements récents
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Par</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeploys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        Aucun déploiement enregistré
                      </TableCell>
                    </TableRow>
                  )}
                  {recentDeploys.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {clientNameMap[d.clientId] ?? d.clientId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            d.environment === 'prod'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-[10px]'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]'
                          }
                        >
                          {d.environment === 'prod' ? 'Prod' : 'Staging'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">
                        {d.versionTag ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} size="sm" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {d.triggeredBy ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(d.startedAt, d.completedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { const slug = clientSlugMap[d.clientId]; if (slug) { setSelectedClientSlug(slug); setCurrentView('pipeline') } }}>
                            <Eye className="size-3" />
                            <span className="hidden xl:inline">Détail</span>
                          </Button>
                          {d.status === 'failed' && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" disabled={retriggerLoading || !clientSlugMap[d.clientId]} onClick={() => { const slug = clientSlugMap[d.clientId]; if (slug) executeRetrigger(() => pipelineApi.retrigger(slug, d.id), { successMessage: 'Pipeline relancé' }) }}>
                              {retriggerLoading ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                              <span className="hidden xl:inline">Relancer</span>
                            </Button>
                          )}
                          {d.rollbackAvailable && d.status !== 'running' && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-orange-600 hover:text-orange-700" disabled={rollbackLoading || !clientSlugMap[d.clientId]} onClick={() => { const slug = clientSlugMap[d.clientId]; if (slug) executeRollback(() => rollbackApi.execute(slug, d.id), { successMessage: 'Rollback lancé' }) }}>
                              {rollbackLoading ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                              <span className="hidden xl:inline">Rollback</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4 & 5: Alertes + Clients ────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alertes actives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Alertes actives
            </CardTitle>
            <CardAction>
              <Badge variant="secondary" className="text-xs">
                {activeAlerts.length} active{activeAlerts.length !== 1 ? 's' : ''}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activeAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune alerte active
                </p>
              ) : (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      alert.level === 'critical'
                        ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'
                        : alert.level === 'warning'
                          ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
                          : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20'
                    }`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{alertEmoji[alert.level]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{alert.message}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>Source : {alert.source}</span>
                        <span>&middot;</span>
                        <span>{safeFormatDate(alert.createdAt) ? formatDistanceToNow(safeFormatDate(alert.createdAt)!, { addSuffix: true, locale: fr }) : '—'}</span>
                        {alert.clientId && (
                          <>
                            <span>&middot;</span>
                            <span>{clientNameMap[alert.clientId]}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={ackLoading} onClick={() => { const slug = clientSlugMap[alert.clientId ?? '']; if (slug) executeAck(() => fetch(`/api/clients/${slug}/alerts/${alert.id}/ack`, { method: 'PUT' }).then(r => r.json()), { successMessage: 'Alerte acquittée' }) }}>
                        {ackLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                        Acquitter
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { if (alert.clientId) { setSelectedClientSlug(clientSlugMap[alert.clientId] ?? null); setCurrentView('clients') } }}>
                        <ExternalLink className="size-3" />
                        Contexte
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clients actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
              Clients actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Version Odoo</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Dernière activité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {effectiveClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">v{client.odooVersion}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={client.status} size="sm" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {safeFormatDate(client.lastActivity) ? formatDistanceToNow(safeFormatDate(client.lastActivity)!, { addSuffix: true, locale: fr }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setSelectedClientSlug(client.slug)}
                        >
                          <ArrowRight className="size-3" />
                          Accéder
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: Logs service ─────────────────────────────────────── */}
      <Dialog open={logsService !== null} onOpenChange={(open) => { if (!open) setLogsService(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-4 text-muted-foreground" />
              Logs — {logsService}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] rounded-md border bg-slate-950 p-3">
            {logsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Chargement des logs…
              </div>
            ) : serviceLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun log disponible</p>
            ) : (
              <div className="space-y-1 font-mono text-xs text-slate-100">
                {serviceLogs.map((l, i) => (
                  <pre key={i} className="whitespace-pre-wrap break-all">
                    <span className="text-slate-400">{l.timestamp}</span>  {l.message}
                  </pre>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <X className="size-3.5" />
                Fermer
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
