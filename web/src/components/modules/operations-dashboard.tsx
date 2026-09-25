'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  ChevronRight,
  CircleDot,
  Gavel,
  Layers,
  ListFilter,
  ShieldAlert,
  TrendingUp,
  UserX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { diffIsoDays, formatIsoFr } from '@/lib/operations/time'
import {
  DASHBOARD_FACET_PAGE_SIZE,
  FACET_LABEL,
  facetKey,
  selectFacet,
} from '@/lib/operations/dashboard'
import {
  STAGE_LABEL,
  type DashboardBar,
  type DashboardFacet,
  type DashboardInitiative,
  type OperationsPayload,
  type OperationTask,
  type StageKey,
} from '@/lib/operations/types'

// Barres CSS : aucune dépendance de graphique n'est introduite, le rendu reste
// identique en mode sombre et ne coûte aucun bundle supplémentaire.
const stageBarColor: Record<StageKey, string> = {
  reception: 'bg-slate-400',
  a_faire: 'bg-blue-500',
  en_cours: 'bg-amber-500',
  bloque: 'bg-red-500',
  en_validation: 'bg-violet-500',
  termine: 'bg-emerald-500',
  annule: 'bg-zinc-400',
  acheve: 'bg-teal-500',
  inconnu: 'bg-orange-500',
}

const stageBadge: Record<StageKey, string> = {
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

function rule(hint: string): string {
  return `Règle de calcul — ${hint}`
}

// jours restants avant l'échéance (négatif = en retard), null si non planifiée
function daysUntil(deadline: string | null, today: string): number | null {
  if (!deadline) return null
  const delta = diffIsoDays(today, deadline)
  return Number.isFinite(delta) ? delta : null
}

// Chaque barre est un bouton: le clic ouvre les tâches du segment. Le libellé et
// le compte restent ceux de la barre, seul l'interaction est ajoutée.
function BarList({
  bars,
  peak,
  color,
  showShare,
  onOpen,
  facetFor,
}: {
  bars: DashboardBar[]
  peak: number
  color: (bar: DashboardBar) => string
  showShare: boolean
  onOpen: (facet: DashboardFacet) => void
  facetFor: (bar: DashboardBar) => DashboardFacet
}) {
  if (bars.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Aucune donnée à représenter.</p>
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {bars.map((bar) => (
        <li key={bar.key}>
          <button
            type="button"
            onClick={() => onOpen(facetFor(bar))}
            className="group flex w-full flex-col gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <div className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="min-w-0 truncate text-foreground" title={bar.label}>
                {bar.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
                {bar.count}
                {showShare && (
                  <span className="text-muted-foreground/70">
                    · {Math.round(bar.share * 100)} %
                  </span>
                )}
                <ChevronRight className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-[width]', color(bar))}
                style={{ width: `${Math.max(2, Math.round((bar.count / peak) * 100))}%` }}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function peakOf(bars: DashboardBar[]): number {
  return Math.max(1, ...bars.map((bar) => bar.count))
}

// Une tuile est un bouton : le clic ouvre la liste des tâches qui composent le
// chiffre. `disabled` évite une fenêtre vide quand le compte vaut zéro.
function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
  facet,
  onOpen,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone: string
  facet: DashboardFacet
  onOpen: (facet: DashboardFacet) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(facet)}
      disabled={value === 0}
      className={cn(
        'group flex flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-left transition-colors',
        'hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card',
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
        <ChevronRight className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </span>
      <span className={cn('text-xl font-semibold tabular-nums', tone)}>{value}</span>
    </button>
  )
}

function ChartCard({
  title,
  icon: Icon,
  hint,
  bars,
  color,
  showShare,
  footer,
  onOpen,
  facetFor,
}: {
  title: string
  icon: React.ElementType
  hint: string
  bars: DashboardBar[]
  color: (bar: DashboardBar) => string
  showShare: boolean
  footer?: string
  onOpen: (facet: DashboardFacet) => void
  facetFor: (bar: DashboardBar) => DashboardFacet
}) {
  return (
    <Card className="min-w-0 gap-3">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <BarList
          bars={bars}
          peak={peakOf(bars)}
          color={color}
          showShare={showShare}
          onOpen={onOpen}
          facetFor={facetFor}
        />
        {footer && <p className="text-[10px] leading-relaxed text-muted-foreground">{footer}</p>}
        <p className="text-[10px] leading-relaxed text-muted-foreground/80">{rule(hint)}</p>
      </CardContent>
    </Card>
  )
}

// Une ligne de la fenêtre d'ouverture: même présentation que les lignes des
// blocs, pour que la lecture soit continue entre le tableau de bord et la liste.
function DrillRow({ task, today }: { task: OperationTask; today: string }) {
  const delta = daysUntil(task.deadline, today)
  const late = delta !== null && delta < 0
  return (
    <li className="flex flex-col gap-1 border-b border-border/60 px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{task.ref}</span>
        <span className="min-w-0 flex-1 text-sm">{task.name}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
            stageBadge[task.stage_key],
          )}
        >
          {STAGE_LABEL[task.stage_key]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="tabular-nums">Prio {task.priority}</span>
        <span className={cn('inline-flex items-center gap-1', late && 'font-semibold text-red-600 dark:text-red-400')}>
          <CalendarClock className="size-3" />
          {task.deadline ? formatIsoFr(task.deadline) : 'Sans échéance'}
          {late && ` · retard ${Math.abs(delta ?? 0)} j`}
        </span>
        {task.assignees.length > 0 && <span>{task.assignees.join(', ')}</span>}
        {task.tags.length > 0 && <span>{task.tags.join(' · ')}</span>}
        {task.parent_id !== null && <span>sous-tâche de {task.parent_id}</span>}
      </div>
    </li>
  )
}

// La fenêtre demandée: 10 tâches, puis « 10 de plus » par palier, ou tout.
// Le compteur reste visible pour toujours savoir combien sont affichées sur
// combien, y compris quand la liste est entièrement dépliée.
function DrilldownDialog({
  facet,
  tasks,
  today,
  onOpenChange,
}: {
  facet: DashboardFacet | null
  tasks: OperationTask[]
  today: string
  onOpenChange: (open: boolean) => void
}) {
  const [limit, setLimit] = useState(DASHBOARD_FACET_PAGE_SIZE)

  const selected = useMemo(
    () => (facet ? selectFacet(tasks, facet, today) : []),
    [facet, tasks, today],
  )

  const visible = selected.slice(0, limit)
  const remaining = selected.length - visible.length
  const title = facet ? FACET_LABEL[facet.kind] : ''
  const subtitle =
    facet?.kind === 'stage'
      ? STAGE_LABEL[facet.key]
      : facet?.kind === 'assignee'
        ? `${facet.key}${facet.openOnly ? ' — charge ouverte' : ''}`
        : null

  return (
    <Dialog open={facet !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <ListFilter className="size-4 text-muted-foreground" />
            {title}
            {subtitle && <Badge variant="secondary">{subtitle}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {selected.length} tâche{selected.length > 1 ? 's' : ''} concernée
            {selected.length > 1 ? 's' : ''} — non terminées d&apos;abord, puis priorité et échéance la
            plus proche.
          </DialogDescription>
        </DialogHeader>

        {selected.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Aucune tâche dans ce segment.
          </p>
        ) : (
          <>
            <ul className="-mx-3 max-h-[52vh] overflow-y-auto border-y border-border/60">
              {visible.map((task) => (
                <DrillRow key={task.id} task={task} today={today} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {visible.length} sur {selected.length} affichée
                {selected.length > 1 ? 's' : ''}
              </span>
              <div className="flex flex-wrap gap-2">
                {remaining > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLimit((current) => current + DASHBOARD_FACET_PAGE_SIZE)}
                  >
                    Afficher {Math.min(DASHBOARD_FACET_PAGE_SIZE, remaining)} de plus
                  </Button>
                )}
                {remaining > 0 && (
                  <Button type="button" size="sm" onClick={() => setLimit(selected.length)}>
                    Tout afficher
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InitiativeRow({ initiative, today }: { initiative: DashboardInitiative; today: string }) {
  const delta = daysUntil(initiative.deadline, today)
  const late = delta !== null && delta < 0
  const percent = Math.round(initiative.completion * 100)
  return (
    <li className="flex flex-col gap-1.5 border-b border-border/60 px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{initiative.ref}</span>
        <span className="min-w-0 flex-1 text-sm">{initiative.name}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
            stageBadge[initiative.stage_key],
          )}
        >
          {STAGE_LABEL[initiative.stage_key]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Layers className="size-3" />
          {initiative.children_open} ouverte{initiative.children_open > 1 ? 's' : ''} sur{' '}
          {initiative.children} sous-tâche{initiative.children > 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className={cn('size-3', late && 'text-red-600 dark:text-red-400')} />
          {initiative.deadline ? formatIsoFr(initiative.deadline) : 'Sans échéance'}
          {late && ` · retard ${Math.abs(delta ?? 0)} j`}
        </span>
        {initiative.tags.length > 0 && <span>{initiative.tags.join(' · ')}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">{percent} % terminé</span>
      </div>
    </li>
  )
}

export function OperationsDashboard({ payload }: { payload: OperationsPayload }) {
  const dashboard = payload.dashboard
  const today = payload.today
  const [facet, setFacet] = useState<DashboardFacet | null>(null)

  const openFacet = useCallback((next: DashboardFacet) => setFacet(next), [])
  const closeFacet = useCallback((open: boolean) => {
    if (!open) setFacet(null)
  }, [])

  const assigneeColor = useMemo(() => {
    const palette = [
      'bg-blue-500',
      'bg-violet-500',
      'bg-teal-500',
      'bg-amber-500',
      'bg-emerald-500',
      'bg-rose-500',
    ]
    const colorFor = new Map<string, string>()
    buildAssigneeColor(dashboard.by_assignee_total, palette, colorFor)
    return (key: string) => colorFor.get(key) ?? 'bg-slate-400'
  }, [dashboard])

  return (
    <div className="flex flex-col gap-4">
      {/* Résumé exécutif — texte calculé, aucune génération externe */}
      <Card className="gap-3">
        <CardHeader className="pb-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-muted-foreground" />
            Résumé exécutif
            <span className="text-[11px] font-normal text-muted-foreground">
              calculé à partir des {dashboard.summary.total} tâches Odoo, sans génération externe
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed">
            {dashboard.summary.lines.map((line, index) => (
              <li key={index} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <MetricTile
              icon={CircleDot}
              label="Ouvertes"
              value={dashboard.summary.open}
              tone="text-blue-600 dark:text-blue-400"
              facet={{ kind: 'open' }}
              onOpen={openFacet}
            />
            <MetricTile
              icon={AlertTriangle}
              label="En retard"
              value={dashboard.summary.late}
              tone="text-red-600 dark:text-red-400"
              facet={{ kind: 'late' }}
              onOpen={openFacet}
            />
            <MetricTile
              icon={ShieldAlert}
              label="Bloquées"
              value={dashboard.summary.blocked}
              tone="text-red-600 dark:text-red-400"
              facet={{ kind: 'blocked' }}
              onOpen={openFacet}
            />
            <MetricTile
              icon={UserX}
              label="Sans responsable"
              value={dashboard.summary.unassigned}
              tone="text-amber-600 dark:text-amber-400"
              facet={{ kind: 'unassigned' }}
              onOpen={openFacet}
            />
            <MetricTile
              icon={Gavel}
              label="Décisions à prendre"
              value={dashboard.summary.decisions_open}
              tone="text-violet-600 dark:text-violet-400"
              facet={{ kind: 'decisions' }}
              onOpen={openFacet}
            />
            <MetricTile
              icon={Briefcase}
              label="Initiatives en cours"
              value={dashboard.summary.initiatives_open}
              tone="text-emerald-600 dark:text-emerald-400"
              facet={{ kind: 'initiatives' }}
              onOpen={openFacet}
            />
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/80">
            {rule(`${dashboard.rules.risk} ${dashboard.rules.drilldown}`)}
          </p>
        </CardContent>
      </Card>

      {/* Trois graphiques — chaque barre est cliquable et ouvre ses tâches */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <ChartCard
          title="Charge par étape"
          icon={Layers}
          hint={dashboard.rules.status}
          bars={dashboard.by_stage}
          color={(bar) => stageBarColor[bar.key as StageKey] ?? 'bg-slate-400'}
          showShare
          onOpen={openFacet}
          facetFor={(bar) => ({ kind: 'stage', key: bar.key as StageKey })}
        />
        <ChartCard
          title="Tâches par responsable"
          icon={CircleDot}
          hint={dashboard.rules.load}
          bars={dashboard.by_assignee_total}
          color={(bar) => assigneeColor(bar.key)}
          showShare
          onOpen={openFacet}
          facetFor={(bar) => ({ kind: 'assignee', key: bar.key, openOnly: false })}
          footer={`${dashboard.summary.top_assignee ?? '—'} porte le plus de charge : ${
            dashboard.summary.top_assignee_count
          } tâche(s).`}
        />
        <ChartCard
          title="Charge ouverte par responsable"
          icon={TrendingUp}
          hint={dashboard.rules.load}
          bars={dashboard.by_assignee_open}
          color={(bar) => assigneeColor(bar.key)}
          showShare
          onOpen={openFacet}
          facetFor={(bar) => ({ kind: 'assignee', key: bar.key, openOnly: true })}
          footer={`${dashboard.summary.open} tâche(s) non terminée(s) répartie(s) sur ce graphique.`}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
        {/* Décisions clés */}
        <Card className="min-w-0 gap-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <Gavel className="size-4 text-muted-foreground" />
              Décisions clés
              <Badge variant="secondary" className="tabular-nums">
                {dashboard.decisions.length}
              </Badge>
              <span className="text-[11px] font-normal text-muted-foreground">
                non terminées d&apos;abord, puis priorité et échéance
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.decisions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aucune décision identifiée : aucun nom ni description ne contient de marqueur de
                décision. Le bloc reste vide plutôt que d&apos;afficher une liste inventée.
              </p>
            ) : (
              <ul className="border-t border-border/60">
                {dashboard.decisions.map((decision) => {
                  const delta = daysUntil(decision.deadline, today)
                  const late = delta !== null && delta < 0
                  return (
                    <li
                      key={decision.id}
                      className="flex flex-col gap-1 border-b border-border/60 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {decision.ref}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">{decision.name}</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
                            stageBadge[decision.stage_key],
                          )}
                        >
                          {STAGE_LABEL[decision.stage_key]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="tabular-nums">Prio {decision.priority}</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            late && 'font-semibold text-red-600 dark:text-red-400',
                          )}
                        >
                          <CalendarClock className="size-3" />
                          {decision.deadline ? formatIsoFr(decision.deadline) : 'Sans échéance'}
                          {late && ` · retard ${Math.abs(delta ?? 0)} j`}
                        </span>
                        {decision.assignees.length > 0 && <span>{decision.assignees.join(', ')}</span>}
                        {!decision.is_open && (
                          <span className="text-emerald-600 dark:text-emerald-400">décidée</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="border-t border-border/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/80">
              {rule(dashboard.rules.decisions)}
            </p>
          </CardContent>
        </Card>

        {/* Efforts clés */}
        <Card className="min-w-0 gap-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <Briefcase className="size-4 text-muted-foreground" />
              Efforts clés
              <Badge variant="secondary" className="tabular-nums">
                {dashboard.initiatives.length}
              </Badge>
              <span className="text-[11px] font-normal text-muted-foreground">
                chantiers parents encore ouverts — {dashboard.summary.initiatives_open} au total,
                les {dashboard.initiatives.length} plus lourds sont listés
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.initiatives.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aucun chantier parent en cours : toutes les tâches sont isolées ou terminées.
              </p>
            ) : (
              <ul className="border-t border-border/60">
                {dashboard.initiatives.map((initiative) => (
                  <InitiativeRow key={initiative.id} initiative={initiative} today={today} />
                ))}
              </ul>
            )}
            <p className="border-t border-border/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/80">
              {rule(`${dashboard.rules.initiatives} ${dashboard.rules.completion}`)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ouverture d'un segment : les tâches du chiffre cliqué, 10 à la fois.
          La clé remonte le composant à chaque segment, donc le palier repart
          de 10 sans avoir à synchroniser un état. */}
      <DrilldownDialog
        key={facet ? facetKey(facet) : 'closed'}
        facet={facet}
        tasks={payload.tasks}
        today={today}
        onOpenChange={closeFacet}
      />
    </div>
  )
}

function buildAssigneeColor(
  bars: DashboardBar[],
  palette: string[],
  target: Map<string, string>,
): void {
  bars.forEach((bar, index) => {
    target.set(bar.key, palette[index % palette.length])
  })
}
