// Badges secondaires: signaux d'affichage qui ne changent jamais
// l'appartenance d'une tâche à un bucket.

import { BUCKET_WINDOW_DAYS } from './buckets'
import { diffIsoDays } from './time'
import type { OperationTask } from './types'

export type SecondaryBadge =
  | 'bloquee'
  | 'en_validation'
  | 'en_retard'
  | 'echeance_aujourdhui'
  | 'echeance_proche'
  | 'sans_echeance'
  | 'recurrent'
  | 'sous_tache'
  | 'clickup'
  | 'github'
  | 'assignes'
  | 'tags'
  | 'priorite'
  | 'inactif'

export const SECONDARY_BADGE_LABEL: Record<SecondaryBadge, string> = {
  bloquee: 'Bloquée',
  en_validation: 'En validation',
  en_retard: 'En retard',
  echeance_aujourdhui: "Échéance aujourd'hui",
  echeance_proche: `Échéance sous ${BUCKET_WINDOW_DAYS} j`,
  sans_echeance: 'Sans échéance',
  recurrent: 'Récurrent',
  sous_tache: 'Sous-tâche',
  clickup: 'Référence ClickUp',
  github: 'Issue GitHub',
  assignes: 'Responsable(s)',
  tags: 'Tags',
  priorite: 'Priorité Odoo',
  inactif: 'Inactive',
}

export function deadlineDelta(task: OperationTask, today: string): number | null {
  if (!task.deadline) return null
  const delta = diffIsoDays(today, task.deadline)
  return Number.isFinite(delta) ? delta : null
}

export function isLate(task: OperationTask, today: string): boolean {
  const delta = deadlineDelta(task, today)
  return delta !== null && delta < 0
}

export function isBlocked(task: OperationTask): boolean {
  return task.stage_key === 'bloque'
}

// une tâche bloquée ET en retard conserve deux badges, un seul bucket (`late`)
export function secondaryBadges(task: OperationTask, today: string): SecondaryBadge[] {
  const badges: SecondaryBadge[] = []
  if (task.stage_key === 'bloque') badges.push('bloquee')
  if (task.stage_key === 'en_validation') badges.push('en_validation')

  const delta = deadlineDelta(task, today)
  if (delta === null) badges.push('sans_echeance')
  else if (delta < 0) badges.push('en_retard')
  else if (delta === 0) badges.push('echeance_aujourdhui')
  else if (delta <= BUCKET_WINDOW_DAYS) badges.push('echeance_proche')

  if (task.is_recurring) badges.push('recurrent')
  if (task.parent_id !== null) badges.push('sous_tache')
  if (task.clickup_id) badges.push('clickup')
  if (task.github_issue !== null) badges.push('github')
  if (task.assignees.length > 0) badges.push('assignes')
  if (task.tags.length > 0) badges.push('tags')
  if (task.priority > 0) badges.push('priorite')
  if (!task.active) badges.push('inactif')

  return badges
}
