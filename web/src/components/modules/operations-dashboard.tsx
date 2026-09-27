'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Gavel,
  Layers,
  ShieldAlert,
  TrendingUp,
  UserX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatIsoFr } from '@/lib/operations/time'
import { odooTaskUrl } from '@/lib/operations/odoo-url'
import { facetKey } from '@/lib/operations/dashboard'
import { ACTION_QUEUE_LIMIT } from '@/lib/operations/lenses'
import {
  STAGE_LABEL,
  type DashboardAction,
  type DashboardBar,
  type DashboardFacet,
  type DashboardInitiative,
  type DashboardLens,
  type OperationsPayload,
  type StageKey,
  type TaskLens,
} from '@/lib/operations/types'
import { DrilldownDialog, daysUntil, stageBadge } from './operations-drilldown'

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

// Une icone par loupe, prise dans la bibliotheque deja importee : ajouter une
// dependance pour un icone n'en vaut pas le cout.
const lensIcon: Record<TaskLens, React.ElementType> = {
  non_assignee: UserX,
  recurrente: CalendarClock,
  bloque: ShieldAlert,
  en_validation: Gavel,
}

// La teinte suit la section equivalente, pour qu'on reconnaisse la loupe a la
// tuile « Interventions » ou « Sans responsable » sans lire le libelle.
const lensTone: Record<TaskLens, string> = {
  non_assignee: 'text-amber-600 dark:text-amber-400',
  recurrente: 'text-blue-600 dark:text-blue-400',
  bloque: 'text-red-600 dark:text-red-400',
  en_validation: 'text-violet-600 dark:text-violet-400',
}

function rule(hint: string): string {
  return `Règle de calcul — ${hint}`
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
function InitiativeRow({ initiative, today }: { initiative: DashboardInitiative; today: string }) {
  const delta = daysUntil(initiative.deadline, today)
  const late = delta !== null && delta < 0
  const percent = Math.round(initiative.completion * 100)
  const href = odooTaskUrl(initiative.id)
  return (
    <li className="flex flex-col gap-1.5 border-b border-border/60 px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{initiative.ref}</span>
        {href === null ? (
          <span className="min-w-0 flex-1 text-sm line-clamp-3" title={initiative.name}>
            {initiative.name}
          </span>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${initiative.ref} dans Odoo`}
            className="min-w-0 flex-1 text-sm line-clamp-3 underline-offset-2 hover:text-foreground hover:underline"
          >
            {initiative.name}
          </a>
        )}
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

// La file d'action reste en lecture seule : le cockpit n'écrit rien dans Odoo.
// En revanche chaque ligne ouvre désormais la tâche dans un onglet (demande
// explicite de l'utilisateur, 2026-09-27). Cette décision inverse la règle
// d'avant-lot, qui interdisait le lien parce qu'aucune URL n'existait encore.
function ActionRow({ action, today }: { action: DashboardAction; today: string }) {
  const late = action.overdue_days > 0
  const href = odooTaskUrl(action.id)
  return (
    <li className="flex flex-col gap-1 border-b border-border/60 px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-muted-foreground">{action.ref}</span>
        {href === null ? (
          <span className="min-w-0 flex-1 text-sm line-clamp-3" title={action.name}>
            {action.name}
          </span>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${action.ref} dans Odoo`}
            className="min-w-0 flex-1 text-sm line-clamp-3 underline-offset-2 hover:text-foreground hover:underline"
          >
            {action.name}
          </a>
        )}
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
            stageBadge[action.stage_key],
          )}
        >
          {STAGE_LABEL[action.stage_key]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="tabular-nums">Prio {action.priority}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 tabular-nums',
            late && 'font-semibold text-red-600 dark:text-red-400',
          )}
        >
          <CalendarClock className="size-3" />
          {action.deadline ? formatIsoFr(action.deadline) : 'Sans échéance'}
          {late && ` · retard ${action.overdue_days} j`}
        </span>
        {action.assignees.length > 0 && <span>{action.assignees.join(', ')}</span>}
        {action.is_recurring && <span className="text-blue-600 dark:text-blue-400">récurrente</span>}
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
          {/* Loupes — quatre axes qui se superposent aux sections de l'onglet
              Tâches. Cliquables comme les tuiles : meme selectFacet, meme
              fenetre, donc le compte et la liste ne peuvent pas diverger. */}
          <div className="flex flex-col gap-1.5">
            <h3 className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <CircleDot className="size-3.5" />
              Loupes
              <span className="font-normal">
                — ne comptent que les tâches non terminées, et se superposent aux
                sections
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {dashboard.lenses.map((lens: DashboardLens) => {
                const Icon = lensIcon[lens.lens]
                return (
                  <MetricTile
                    key={lens.lens}
                    icon={Icon}
                    label={lens.label}
                    value={lens.count}
                    tone={lensTone[lens.lens]}
                    facet={{ kind: 'lens', lens: lens.lens }}
                    onOpen={openFacet}
                  />
                )
              })}
              <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                {rule(dashboard.rules.lenses)}
              </p>
            </div>
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

      {/* File d'action — l'ordre est l'information, pas les chiffres */}
      <Card className="gap-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-muted-foreground" />
            File d&apos;action
            <Badge variant="secondary" className="tabular-nums">
              {dashboard.action_queue.length}
            </Badge>
            <span className="text-[11px] font-normal text-muted-foreground">
              les {ACTION_QUEUE_LIMIT} tâches non terminées à l&apos;échéance la plus ancienne
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dashboard.action_queue.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Aucune tâche ouverte : la file est vide. Le bloc reste affiché plutôt que
              d&apos;être masqué, pour que son absence soit visible et pas interpretée.
            </p>
          ) : (
            <ul className="border-t border-border/60">
              {dashboard.action_queue.map((action) => (
                <ActionRow key={action.id} action={action} today={today} />
              ))}
            </ul>
          )}
          <p className="px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/80">
            {rule(dashboard.rules.action)}
          </p>
        </CardContent>
      </Card>

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
                        <span className="min-w-0 flex-1 text-sm line-clamp-3" title={decision.name}>
                          {decision.name}
                        </span>
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
