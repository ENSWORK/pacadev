'use client'

// Fenêtre d'ouverture d'un segment, partagée par les deux onglets du cockpit :
// le tableau de bord (tuiles et barres) et l'onglet Tâches (KPI). Elle vit dans
// son propre module pour n'exister qu'une fois : dupliquer la même fenêtre dans
// les deux composants ferait diverger la pagination et les libellés.
//
// Le contenu vient de selectFacet() appliqué à la projection déjà chargée : aucun
// appel réseau, donc le compte affiché et la liste ouverte ne peuvent pas diverger.

import { useMemo, useState } from 'react'
import { CalendarClock, ExternalLink, ListFilter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BUCKET_HINT, BUCKET_LABEL } from '@/lib/operations/buckets'
import { odooTaskUrl } from '@/lib/operations/odoo-url'
import {
  DASHBOARD_FACET_PAGE_SIZE,
  FACET_LABEL,
  selectFacet,
} from '@/lib/operations/dashboard'
// LENS_LABEL et LENS_HINT viennent du module des loupes : la fenêtre ne réécrit
// pas les règles, elle affiche celles qui ont produit le chiffre.
import { LENS_HINT, LENS_LABEL } from '@/lib/operations/lenses'
import { diffIsoDays, formatIsoFr } from '@/lib/operations/time'
import {
  STAGE_LABEL,
  type DashboardFacet,
  type OperationTask,
  type StageKey,
} from '@/lib/operations/types'

// Palettes d'étapes partagées par la fenêtre et par le bloc « Décisions clés »
// du tableau de bord : une seule source, sinon les deux listes divergent.
export const stageBadge: Record<StageKey, string> = {
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

// jours restants avant l'échéance (négatif = en retard), null si non planifiée
export function daysUntil(deadline: string | null, today: string): number | null {
  if (!deadline) return null
  const delta = diffIsoDays(today, deadline)
  return Number.isFinite(delta) ? delta : null
}

function DrillRow({ task, today }: { task: OperationTask; today: string }) {
  const delta = daysUntil(task.deadline, today)
  const late = delta !== null && delta < 0
  const href = odooTaskUrl(task.id)
  return (
    <li className="flex flex-col gap-1 border-b border-border/60 px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {href === null ? (
          <span className="font-mono text-[11px] text-muted-foreground">{task.ref}</span>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${task.ref} dans Odoo`}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {task.ref}
            <ExternalLink className="size-2.5" />
          </a>
        )}
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
export function DrilldownDialog({
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

  // Le sous-titre nomme le segment précis, la description rappelle la règle qui
  // l'a produit : sans elle, une tâche listée ici semblerait mal classée.
  const subtitle =
    facet?.kind === 'stage'
      ? STAGE_LABEL[facet.key]
      : facet?.kind === 'assignee'
        ? `${facet.key}${facet.openOnly ? ' — charge ouverte' : ''}`
        : facet?.kind === 'bucket'
          ? BUCKET_LABEL[facet.bucket]
          : facet?.kind === 'lens'
            ? LENS_LABEL[facet.lens]
            : facet?.kind === 'total'
              ? 'terminées comprises'
              : null

  // La règle affichée est celle qui a produit le chiffre : sans elle, une tâche
  // listée ici semblerait mal classée.
  const hint =
    facet?.kind === 'bucket'
      ? BUCKET_HINT[facet.bucket]
      : facet?.kind === 'lens'
        ? LENS_HINT[facet.lens]
        : 'non terminées d’abord, puis priorité et échéance la plus proche'

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
            {selected.length > 1 ? 's' : ''} — {hint}.
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
