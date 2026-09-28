// Buckets exclusifs - une tache = une seule ligne, ordre d'evaluation strict

import { diffIsoDays } from './time'
import {
  TERMINAL_STAGE_KEYS,
  type OperationTask,
  type OperationsKpis,
  type StageKey,
  type TaskBucket,
} from './types'

export const BUCKET_ORDER: readonly TaskBucket[] = [
  'done',
  'late',
  'today',
  'intervention',
  'sans_echeance',
  'j14',
  'plus_tard',
]

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  done: 'Terminées',
  late: 'En retard',
  today: "Aujourd'hui",
  intervention: 'Interventions',
  sans_echeance: 'Sans échéance',
  j14: 'J+14',
  plus_tard: 'Plus tard',
}

export const BUCKET_HINT: Record<TaskBucket, string> = {
  done: 'Achevé, Terminé ou Annulé - étape réelle affichée sur chaque ligne',
  late: 'Échéance dépassée, tâche non terminée, ni bloquée ni en validation',
  today: 'Échéance aujourd’hui, tâche non terminée, ni bloquée ni en validation',
  intervention: 'Bloquée ou en validation, même si l’échéance est dépassée',
  sans_echeance: 'Sans date d’échéance, à faire ou en réception',
  j14: 'Échéance entre J+1 et J+14',
  plus_tard: 'Échéance au-delà de J+14',
}

export const BUCKET_WINDOW_DAYS = 14

export function emptyBuckets(): Record<TaskBucket, OperationTask[]> {
  return {
    done: [],
    late: [],
    today: [],
    intervention: [],
    sans_echeance: [],
    j14: [],
    plus_tard: [],
  }
}

// Ordre d'affichage des sections de l'onglet Tâches. « done » en est absent :
// les tâches terminées ne sont pas listées, elles restent seulement comptées
// (KPI et tableau de bord). Décision utilisateur du 2026-09-25.
export const VISIBLE_BUCKET_ORDER: readonly TaskBucket[] = BUCKET_ORDER.filter(
  (bucket) => bucket !== 'done',
)

// Une tâche qui attend une décision humaine n'est pas « en retard » : elle est
// en attente. C'est la décision utilisateur du 2026-09-27, et elle change
// « En retard » de 25 à 22 tâches et « Interventions » de 10 à 13 sur les
// données réelles : les trois tâches concerned (odoo:17, odoo:18, odoo:186)
// étaient comptées en retard alors qu'elles sont bloquées ou en validation.
export function isInterventionStage(stage: StageKey): boolean {
  return stage === 'bloque' || stage === 'en_validation'
}

// Partagé par bucketOf(), buildSummary() et selectFacet() : les trois doivent
// compter la même chose, sinon le chiffre dépend de la tuile cliquée.
export function isLate(task: OperationTask, today: string): boolean {
  if (task.is_terminal || isInterventionStage(task.stage_key)) return false
  if (!task.deadline) return false
  return diffIsoDays(today, task.deadline) < 0
}

// Même question que isLate, pour l'échéance du jour. Partagé pour la même
// raison : sans lui, la tuile « Aujourd'hui » et la section « Aujourd'hui »
// divergent dès qu'une tâche bloquée arrive à échéance.
export function isDueToday(task: OperationTask, today: string): boolean {
  if (task.is_terminal || isInterventionStage(task.stage_key)) return false
  if (!task.deadline) return false
  return diffIsoDays(today, task.deadline) === 0
}

// null = aucune regle ne s'applique (donnee hors modele, jamais masquee)
export function bucketOf(task: OperationTask, today: string): TaskBucket | null {
  const stage = task.stage_key
  if (TERMINAL_STAGE_KEYS.includes(stage)) return 'done'

  // L'étape l'emporte sur l'échéance : une tâche bloquée ou en validation reste
  // dans « Interventions », quelle que soit sa date.
  if (isInterventionStage(stage)) return 'intervention'

  const delta = task.deadline ? diffIsoDays(today, task.deadline) : Number.NaN
  if (Number.isFinite(delta)) {
    if (delta < 0) return 'late'
    if (delta === 0) return 'today'
  }

  if (!Number.isFinite(delta) && (stage === 'a_faire' || stage === 'reception')) {
    return 'sans_echeance'
  }

  if (Number.isFinite(delta) && delta >= 1 && delta <= BUCKET_WINDOW_DAYS) return 'j14'
  if (Number.isFinite(delta) && delta > BUCKET_WINDOW_DAYS) return 'plus_tard'

  return null
}

export interface BucketAssignment {
  buckets: Record<TaskBucket, OperationTask[]>
  unclassified: OperationTask[]
}

export function assignBuckets(tasks: OperationTask[], today: string): BucketAssignment {
  const buckets = emptyBuckets()
  const unclassified: OperationTask[] = []
  for (const task of tasks) {
    const bucket = bucketOf(task, today)
    if (bucket) buckets[bucket].push(task)
    else unclassified.push(task)
  }
  return { buckets, unclassified }
}

export function computeKpis(
  buckets: Record<TaskBucket, OperationTask[]>,
  total: number,
): OperationsKpis {
  return {
    total,
    done: buckets.done.length,
    late: buckets.late.length,
    today: buckets.today.length,
    intervention: buckets.intervention.length,
    sans_echeance: buckets.sans_echeance.length,
    j14: buckets.j14.length,
  }
}
