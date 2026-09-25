// Buckets exclusifs - une tache = une seule ligne, ordre d'evaluation strict

import { diffIsoDays } from './time'
import {
  TERMINAL_STAGE_KEYS,
  type OperationTask,
  type OperationsKpis,
  type TaskBucket,
} from './types'

export const BUCKET_ORDER: readonly TaskBucket[] = [
  'done',
  'late',
  'today',
  'intervention',
  'a_planifier',
  'j14',
  'plus_tard',
]

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  done: 'Terminées',
  late: 'En retard',
  today: "Aujourd'hui",
  intervention: 'Interventions',
  a_planifier: 'À planifier',
  j14: 'J+14',
  plus_tard: 'Plus tard',
}

export const BUCKET_HINT: Record<TaskBucket, string> = {
  done: 'Achevé, Terminé ou Annulé - étape réelle affichée sur chaque ligne',
  late: 'Échéance dépassée et tâche non terminée',
  today: 'Échéance aujourd’hui et tâche non terminée',
  intervention: 'Bloquée ou en validation',
  a_planifier: 'Sans échéance, à faire ou en réception',
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
    a_planifier: [],
    j14: [],
    plus_tard: [],
  }
}

// null = aucune regle ne s'applique (donnee hors modele, jamais masquee)
export function bucketOf(task: OperationTask, today: string): TaskBucket | null {
  const stage = task.stage_key
  if (TERMINAL_STAGE_KEYS.includes(stage)) return 'done'

  const delta = task.deadline ? diffIsoDays(today, task.deadline) : Number.NaN
  if (Number.isFinite(delta)) {
    if (delta < 0) return 'late'
    if (delta === 0) return 'today'
  }

  if (stage === 'bloque' || stage === 'en_validation') return 'intervention'

  if (!Number.isFinite(delta) && (stage === 'a_faire' || stage === 'reception')) {
    return 'a_planifier'
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
    a_planifier: buckets.a_planifier.length,
    j14: buckets.j14.length,
  }
}
