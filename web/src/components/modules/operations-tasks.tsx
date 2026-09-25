'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  FileWarning,
  Filter,
  Inbox,
  KeyRound,
  Layers,
  ListFilter,
  Loader2,
  LogOut,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  Timer,
  TrendingUp,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { OperationsDashboard } from '@/components/modules/operations-dashboard'
import { DrilldownDialog } from '@/components/modules/operations-drilldown'
import { deadlineDelta, isBlocked, secondaryBadges } from '@/lib/operations/badges'
import {
  BUCKET_HINT,
  BUCKET_LABEL,
  BUCKET_ORDER,
} from '@/lib/operations/buckets'
import { facetKey } from '@/lib/operations/dashboard'
import { formatAge, formatIsoFr } from '@/lib/operations/time'
import {
  STAGE_LABEL,
  TERMINAL_STAGE_KEYS,
  type DashboardFacet,
  type OperationTask,
  type OperationsPayload,
  type StageKey,
  type TaskBucket,
} from '@/lib/operations/types'

// ── Constantes d'affichage ────────────────────────────────────────────────

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'unconfigured' | 'error'
type Density = 'compact' | 'standard' | 'detailed'
type Period = 0 | 7 | 30 | 90
type OpsTab = 'dashboard' | 'tasks'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 0, label: 'Toutes' },
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
]

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Détaillé' },
]

const PAGE_SIZES = [10, 25, 50, 100] as const

const ALL = 'all'
const NONE = '__none__'

const stageStyles: Record<StageKey, string> = {
  reception: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
  a_faire: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  en_cours: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  bloque: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  en_validation: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  termine: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  annule: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  acheve: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  inconnu: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
}

const bucketStyles: Record<TaskBucket, string> = {
  done: 'text-emerald-600 dark:text-emerald-400',
  late: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  intervention: 'text-violet-600 dark:text-violet-400',
  a_planifier: 'text-blue-600 dark:text-blue-400',
  j14: 'text-cyan-600 dark:text-cyan-400',
  plus_tard: 'text-slate-600 dark:text-slate-400',
}

// Chaque KPI est un bouton qui ouvre la fenêtre de segment, comme les tuiles du
// tableau de bord : la liste vient de selectFacet(), donc elle affiche exactement
// le compte annoncé. Le champ bucket ne sert plus qu'à la couleur.
//
// Deux exceptions assumées :
// - « Terminées » n'a pas de facet. Lister 92 tâches terminées n'apporte rien au
//   pilotage, donc la tuile reste un simple compteur, sans interaction.
// - « Total » ouvre bien toutes les tâches, terminées comprises, puisque c'est ce
//   que son libellé annonce ; la fenêtre le rappelle explicitement.
const kpiDefinitions: {
  key: keyof OperationsPayload['kpis']
  label: string
  bucket: TaskBucket
  icon: React.ElementType
  facet: DashboardFacet | null
}[] = [
  { key: 'total', label: 'Total', bucket: 'done', icon: Layers, facet: { kind: 'total' } },
  { key: 'done', label: 'Terminées', bucket: 'done', icon: CheckCircle2, facet: null },
  {
    key: 'late',
    label: 'En retard',
    bucket: 'late',
    icon: AlertTriangle,
    facet: { kind: 'bucket', bucket: 'late' },
  },
  {
    key: 'today',
    label: "Aujourd'hui",
    bucket: 'today',
    icon: CalendarClock,
    facet: { kind: 'bucket', bucket: 'today' },
  },
  {
    key: 'intervention',
    label: 'Interventions',
    bucket: 'intervention',
    icon: ShieldAlert,
    facet: { kind: 'bucket', bucket: 'intervention' },
  },
  {
    key: 'a_planifier',
    label: 'À planifier',
    bucket: 'a_planifier',
    icon: ClipboardList,
    facet: { kind: 'bucket', bucket: 'a_planifier' },
  },
  { key: 'j14', label: 'J+14', bucket: 'j14', icon: Timer, facet: { kind: 'bucket', bucket: 'j14' } },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function formatClock(iso: string): string {
  if (!iso) return '—'
  const stamp = Date.parse(iso)
  if (Number.isNaN(stamp)) return iso
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(stamp))
}

function matchesReference(task: OperationTask, needle: string): boolean {
  if (needle.length === 0) return true
  const lower = needle.toLowerCase()
  if (task.ref.toLowerCase().includes(lower)) return true
  if (String(task.id) === needle.trim()) return true
  if (task.clickup_id && task.clickup_id.toLowerCase().includes(lower)) return true
  if (task.github_issue !== null && String(task.github_issue) === needle.trim()) return true
  return false
}

function deadlineLabel(task: OperationTask, today: string): { text: string; urgent: boolean } {
  const delta = deadlineDelta(task, today)
  if (delta === null) return { text: 'Sans échéance', urgent: false }
  if (delta < 0) return { text: `Retard ${Math.abs(delta)} j`, urgent: true }
  if (delta === 0) return { text: "Échéance aujourd'hui", urgent: true }
  if (delta === 1) return { text: 'J+1', urgent: false }
  return { text: `J+${delta}`, urgent: false }
}

// ── Badge de priorité (valeur Odoo brute, aucune sémantique inventée) ─────

function PriorityBadge({ priority }: { priority: number }) {
  const styles = [
    'text-muted-foreground border-border',
    'text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-800',
    'text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800',
    'text-red-700 border-red-300 dark:text-red-300 dark:border-red-800',
  ]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium tabular-nums',
        styles[Math.min(Math.max(priority, 0), 3)]
      )}
    >
      Prio {priority}
    </span>
  )
}

// ── Ligne de tâche unique ────────────────────────────────────────────────

function TaskRow({
  task,
  today,
  density,
}: {
  task: OperationTask
  today: string
  density: Density
}) {
  const deadline = deadlineLabel(task, today)
  const deadlineText = task.deadline ? formatIsoFr(task.deadline) : '—'
  const stage = STAGE_LABEL[task.stage_key]
  const badges = new Set(secondaryBadges(task, today))

  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-b border-border/60 px-3 last:border-b-0',
        density === 'compact' ? 'py-1.5' : 'py-2.5'
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{task.ref}</span>
        <span className={cn('min-w-0 flex-1', density === 'compact' ? 'text-xs' : 'text-sm')}>
          {task.name}
        </span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
            stageStyles[task.stage_key]
          )}
        >
          {stage}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] tabular-nums',
            deadline.urgent ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'
          )}
        >
          <CalendarClock className="size-3" />
          {deadlineText}
          {deadline.text !== deadlineText && ` · ${deadline.text}`}
        </span>
        <PriorityBadge priority={task.priority} />
        {badges.has('bloquee') && (
          <Badge variant="outline" className="border-red-300 text-[10px] text-red-700 dark:border-red-800 dark:text-red-300">
            Bloquée
          </Badge>
        )}
        {badges.has('en_validation') && (
          <Badge variant="outline" className="border-violet-300 text-[10px] text-violet-700 dark:border-violet-800 dark:text-violet-300">
            En validation
          </Badge>
        )}
        {badges.has('recurrent') && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <RefreshCw className="size-2.5" />
            Récurrent
          </Badge>
        )}
        {badges.has('sous_tache') && task.parent_id !== null && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Layers className="size-2.5" />
            Sous-tâche de {task.parent_id}
          </Badge>
        )}
        {badges.has('clickup') && task.clickup_id && (
          <Badge variant="outline" className="font-mono text-[10px]">
            CU:{task.clickup_id}
          </Badge>
        )}
        {badges.has('github') && task.github_issue !== null && (
          <Badge variant="outline" className="font-mono text-[10px]">
            GH:{task.github_issue}
          </Badge>
        )}
        {badges.has('assignes') && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="size-2.5" />
            {task.assignees.join(', ')}
          </span>
        )}
        {density !== 'compact' && badges.has('tags') && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Tag className="size-2.5" />
            {task.tags.join(', ')}
          </span>
        )}
        {badges.has('inactif') && (
          <Badge variant="secondary" className="text-[10px]">
            Inactive
          </Badge>
        )}
      </div>

      {density === 'detailed' && task.description_excerpt && (
        <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
          {task.description_excerpt}
        </p>
      )}
    </div>
  )
}

// ── Section de bucket ─────────────────────────────────────────────────────

function BucketSection({
  bucket,
  tasks,
  today,
  density,
  page,
  pageSize,
  onPage,
}: {
  bucket: TaskBucket
  tasks: OperationTask[]
  today: string
  density: Density
  page: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize))
  const current = Math.min(page, pageCount)
  const visible = tasks.slice((current - 1) * pageSize, current * pageSize)
  const stages = Array.from(new Set(tasks.map((task) => task.stage_key)))

  return (
    <Card data-bucket={bucket} className="min-w-0 gap-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn('text-base font-semibold', bucketStyles[bucket])}>
            {BUCKET_LABEL[bucket]}
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {tasks.length}
          </Badge>
          <span className="text-[11px] font-normal text-muted-foreground">
            {BUCKET_HINT[bucket]}
          </span>
        </CardTitle>
        {bucket === 'done' && stages.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Étapes réelles présentes : {stages.map((key) => STAGE_LABEL[key]).join(' · ')}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Aucune tâche dans cette section avec les filtres actuels.
          </p>
        ) : (
          <>
            <div className="border-t border-border/60">
              {visible.map((task) => (
                <TaskRow key={task.id} task={task} today={today} density={density} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                {visible.length} ligne(s) affichée(s) · {tasks.length} au total · page{' '}
                {current}/{pageCount}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={current <= 1}
                  onClick={() => onPage(current - 1)}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={current >= pageCount}
                  onClick={() => onPage(current + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Module principal ──────────────────────────────────────────────────────

export function OperationsTasksModule() {
  const [state, setState] = useState<LoadState>('loading')
  const [payload, setPayload] = useState<OperationsPayload | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period>(0)
  const [stage, setStage] = useState<string>(ALL)
  const [priority, setPriority] = useState<string>(ALL)
  const [assignee, setAssignee] = useState<string>(ALL)
  const [tag, setTag] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [density, setDensity] = useState<Density>('standard')
  const [pageSize, setPageSize] = useState<number>(25)
  const [pages, setPages] = useState<Record<string, number>>({})
  // Segment ouvert dans la fenêtre, comme sur le tableau de bord. La clé du
  // DrilldownDialog repart de 10 tâches à chaque ouverture, sans état à suivre.
  const [facet, setFacet] = useState<DashboardFacet | null>(null)
  // Le tableau de bord est l'écran d'arrivée : le cockpit sert d'abord au pilotage.
  const [tab, setTab] = useState<OpsTab>('dashboard')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const response = await fetch('/api/operations/tasks', { cache: 'no-store' })
      if (response.status === 401) {
        setPayload(null)
        setMessage(null)
        setState('unauthorized')
        return
      }
      if (response.status === 503) {
        setPayload(null)
        setState('unconfigured')
        const body = await response.json().catch(() => null)
        setMessage(body?.errors?.[0] ?? 'Cockpit non configuré sur le serveur.')
        return
      }
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        setState('error')
        setMessage(body?.errors?.[0] ?? `Erreur HTTP ${response.status}`)
        return
      }
      setPayload(body.data as OperationsPayload)
      setMessage(null)
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(`Requête impossible : ${(error as Error).message}`)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/operations/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        setPassword('')
        await load()
        return
      }
      const body = await response.json().catch(() => null)
      setMessage(body?.errors?.[0] ?? `Ouverture refusée (HTTP ${response.status})`)
    } catch (error) {
      setMessage(`Requête impossible : ${(error as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const logout = async () => {
    await fetch('/api/operations/session', { method: 'DELETE' }).catch(() => null)
    setPayload(null)
    setPages({})
    setState('unauthorized')
  }

  const filters = useMemo(
    () => ({ period, stage, priority, assignee, tag, search: search.trim() }),
    [period, stage, priority, assignee, tag, search]
  )

  const options = useMemo(() => {
    const assignees = new Set<string>()
    const tags = new Set<string>()
    const stages = new Set<StageKey>()
    for (const task of payload?.tasks ?? []) {
      task.assignees.forEach((entry) => assignees.add(entry))
      task.tags.forEach((entry) => tags.add(entry))
      stages.add(task.stage_key)
    }
    return {
      assignees: Array.from(assignees).sort((a, b) => a.localeCompare(b, 'fr')),
      tags: Array.from(tags).sort((a, b) => a.localeCompare(b, 'fr')),
      stages: Array.from(stages).sort((a, b) => STAGE_LABEL[a].localeCompare(STAGE_LABEL[b], 'fr')),
    }
  }, [payload])

  const filtered = useMemo(() => {
    if (!payload) return null
    const keep = (task: OperationTask) => {
      if (filters.stage !== ALL && task.stage_key !== filters.stage) return false
      if (filters.priority !== ALL && String(task.priority) !== filters.priority) return false
      if (filters.assignee === NONE && task.assignees.length > 0) return false
      if (filters.assignee !== ALL && filters.assignee !== NONE && !task.assignees.includes(filters.assignee)) {
        return false
      }
      if (filters.tag === NONE && task.tags.length > 0) return false
      if (filters.tag !== ALL && filters.tag !== NONE && !task.tags.includes(filters.tag)) return false
      if (!matchesReference(task, filters.search)) return false
      if (filters.period > 0) {
        const delta = deadlineDelta(task, payload.today)
        if (delta !== null && (delta < -filters.period || delta > filters.period)) return false
      }
      return true
    }
    const buckets = {} as Record<TaskBucket, OperationTask[]>
    for (const key of BUCKET_ORDER) {
      buckets[key] = payload.buckets[key].filter(keep)
    }
    return { buckets, unclassified: payload.unclassified.filter(keep) }
  }, [payload, filters])

  useEffect(() => {
    setPages({})
  }, [filters])

  const visibleTotal = filtered
    ? BUCKET_ORDER.reduce((sum, key) => sum + (filtered.buckets[key]?.length ?? 0), 0) +
      filtered.unclassified.length
    : 0

  // ── Garde par mot de passe ────────────────────────────────────────────
  if (state === 'unauthorized') {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4" />
              Cockpit opérations — accès protégé
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Les données du cockpit sont réservées à PACADAI. Saisissez le mot de passe du cockpit
              pour ouvrir la session. Le cockpit reste en lecture seule.
            </p>
            <form onSubmit={submitPassword} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="operations-password">Mot de passe</Label>
                <Input
                  id="operations-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mot de passe du cockpit"
                />
              </div>
              {message && <p className="text-xs text-destructive">{message}</p>}
              <Button type="submit" disabled={submitting || password.length === 0}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Ouvrir la session
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'unconfigured') {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileWarning className="size-4 text-amber-600" />
              Cockpit non configuré
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs leading-relaxed">
            <p>{message}</p>
            <p className="text-muted-foreground">
              Le serveur doit définir <code className="font-mono">OPERATIONS_TASKS_PASSWORD</code> dans
              son fichier <code className="font-mono">web/.env</code>. Tant qu&apos;il est absent, l&apos;API
              répond <code className="font-mono">503</code> et aucune session ne peut être ouverte. Le
              cockpit ne s&apos;ouvre jamais par défaut.
            </p>
            <Button variant="outline" onClick={() => void load()} className="w-fit">
              <RefreshCw className="size-4" />
              Revérifier
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === 'loading' || (state === 'error' && !payload)) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
        {message && <p className="text-xs text-destructive">{message}</p>}
      </div>
    )
  }

  if (!payload || !filtered) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              Données indisponibles
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs">
            <p>{message}</p>
            <Button variant="outline" onClick={() => void load()} className="w-fit">
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { freshness } = payload

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Cockpit opérations</h1>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Eye className="size-2.5" />
              Lecture seule
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Odoo source de vérité
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {payload.kpis.total} tâche(s) · aujourd&apos;hui = {formatIsoFr(payload.today)} ({payload.timezone})
            {tab === 'tasks' && ` · ${visibleTotal} ligne(s) après filtres`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Actualiser
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="size-4" />
            Fermer la session
          </Button>
        </div>
      </div>

      {/* Fraîcheur et source */}
      <Card className="gap-3">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-3.5 text-muted-foreground" />
            Source : <span className="font-medium">{freshness.source}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-muted-foreground" />
            Générée le {formatClock(freshness.generated_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-3.5 text-muted-foreground" />
            Âge : {formatAge(freshness.age_seconds)}
          </span>
          {freshness.stale ? (
            <Badge variant="outline" className="gap-1 border-amber-400 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-2.5" />
              Donnée obsolète (seuil {Math.round(freshness.stale_after_seconds / 60)} min)
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-emerald-400 text-[10px] text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-2.5" />
              Donnée fraîche
            </Badge>
          )}
          {freshness.detail && (
            <span className="text-[11px] text-muted-foreground">{freshness.detail}</span>
          )}
          {message && <span className="text-[11px] text-destructive">{message}</span>}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(value) => setTab(value as OpsTab)} className="gap-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <TrendingUp className="size-4" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListFilter className="size-4" />
            Tâches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <OperationsDashboard payload={payload} />
        </TabsContent>

        <TabsContent value="tasks">
      {/* Règles de classement */}
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-1.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Achevé</span> et{' '}
            <span className="font-medium text-foreground">Terminé</span> sont deux étapes distinctes
            d&apos;Odoo ({TERMINAL_STAGE_KEYS.map((key) => STAGE_LABEL[key]).join(', ')}) : elles ne
            sont jamais confondues ni fusionnées, chaque ligne affiche son étape réelle.
          </p>
          <p>
            Chaque tâche n&apos;apparaît que dans <span className="font-medium text-foreground">un seul</span>{' '}
            bucket (ordre : terminées → en retard → aujourd&apos;hui → interventions → à planifier → J+14 → plus
            tard). Les badges sont secondaires : une tâche bloquée et en retard reste dans « En retard »
            avec son badge « Bloquée ».
          </p>
          {payload.clickup_parity.available === false && (
            <p className="text-muted-foreground/80">
              Comparaison ClickUp inactive : {payload.clickup_parity.reason} Aucune donnée Odoo
              n&apos;est masquée pour autant.
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI — chaque compteur ouvre la fenêtre de segment, sauf « Terminées ». */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kpiDefinitions.map((definition) => {
          const value = payload.kpis[definition.key]
          const body = (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <definition.icon className="size-3.5" />
                {definition.label}
              </span>
              <span className={cn('text-2xl font-semibold tabular-nums', bucketStyles[definition.bucket])}>
                {value}
              </span>
            </>
          )
          if (!definition.facet) {
            return (
              <div
                key={definition.key}
                title="Comptage seul : les tâches terminées se consultent dans leur section, plus bas."
                className="flex cursor-default flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left"
              >
                {body}
              </div>
            )
          }
          const facet = definition.facet
          return (
            <button
              key={definition.key}
              type="button"
              onClick={() => setFacet(facet)}
              title={`Afficher les ${value} tâche(s) de « ${definition.label} »`}
              className="group flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-foreground"
            >
              {body}
            </button>
          )
        })}
      </div>

      {/* Ouverture d'un segment depuis un KPI : mêmes 10 tâches, mêmes paliers que
          le tableau de bord. La liste vient de selectFacet(), donc elle affiche
          exactement le compte du KPI. */}
      <DrilldownDialog
        key={facet ? facetKey(facet) : 'closed'}
        facet={facet}
        tasks={payload.tasks}
        today={payload.today}
        onOpenChange={(open) => {
          if (!open) setFacet(null)
        }}
      />

      {/* Filtres */}
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-3 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="operations-search" className="text-[11px]">
                Référence
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="operations-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="odoo:142, 142 ou identifiant ClickUp"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px]">Échéance</Label>
              <Select value={String(period)} onValueChange={(value) => setPeriod(Number(value) as Period)}>
                <SelectTrigger size="sm" className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px]">Étape</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger size="sm" className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">Toutes</SelectItem>
                  {options.stages.map((key) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {STAGE_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px]">Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger size="sm" className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">Toutes</SelectItem>
                  {[0, 1, 2, 3].map((value) => (
                    <SelectItem key={value} value={String(value)} className="text-xs">
                      Prio {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px]">Responsable</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger size="sm" className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">Tous</SelectItem>
                  {options.assignees.length === 0 && (
                    <SelectItem value={NONE} className="text-xs">Aucun responsable</SelectItem>
                  )}
                  {options.assignees.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                  {options.assignees.length > 0 && (
                    <SelectItem value={NONE} className="text-xs">Aucun responsable</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px]">Service / tag</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger size="sm" className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">Tous</SelectItem>
                  {options.tags.length === 0 && (
                    <SelectItem value={NONE} className="text-xs">Aucun tag</SelectItem>
                  )}
                  {options.tags.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                  {options.tags.length > 0 && (
                    <SelectItem value={NONE} className="text-xs">Aucun tag</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ListFilter className="size-3.5" />
              Densité
            </div>
            <Select value={density} onValueChange={(value) => setDensity(value as Density)}>
              <SelectTrigger size="sm" className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DENSITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Filter className="size-3.5" />
              Lignes par page
            </div>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger size="sm" className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((value) => (
                  <SelectItem key={value} value={String(value)} className="text-xs">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setPeriod(0)
                setStage(ALL)
                setPriority(ALL)
                setAssignee(ALL)
                setTag(ALL)
                setSearch('')
              }}
            >
              <Inbox className="size-3.5" />
              Réinitialiser les filtres
            </Button>

            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MousePointerClick className="size-3.5" />
              Les tâches sans échéance restent visibles quel que soit le filtre de période
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sections par bucket, dans l'ordre validé — en colonnes pour rester lisible d'un coup d'œil */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {BUCKET_ORDER.map((bucket) => (
          <BucketSection
            key={bucket}
            bucket={bucket}
            tasks={filtered.buckets[bucket] ?? []}
            today={payload.today}
            density={density}
            page={pages[bucket] ?? 1}
            pageSize={pageSize}
            onPage={(page) => setPages((current) => ({ ...current, [bucket]: page }))}
          />
        ))}

        {filtered.unclassified.length > 0 && (
          <Card className="min-w-0 border-orange-300 dark:border-orange-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-base font-semibold text-orange-600 dark:text-orange-400">
                  Non classées
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {filtered.unclassified.length}
                </Badge>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Aucune règle de bucket ne s&apos;applique : affichées telles quelles, jamais masquées
                </span>
              </CardTitle>
            </CardHeader>
          <CardContent className="p-0">
            {filtered.unclassified.map((task) => (
              <TaskRow key={task.id} task={task} today={payload.today} density={density} />
            ))}
          </CardContent>
        </Card>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
