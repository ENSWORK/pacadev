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

// ATTENTION : ce predicat n'est PAS `isLate` de buckets.ts, et c'est volontaire.
// Ici on decrit ce qui est vrai de la ligne : une tache bloquee ET depassee garde
// son badge « en retard », parce que c'est precisement l'information qui permet de
// la debloquer. La priorisation, elle, ignore l'echeance quand l'etape est
// Bloquee ou En validation. Deux reponses legitimes a deux questions
// differentes : deux noms, sinon le prochain import reintroduit l'ecart 25/22
// entre la tuile « En retard » et la section « En retard ».
export function isDeadlineOverdue(task: OperationTask, today: string): boolean {
  const delta = deadlineDelta(task, today)
  // `delta !== null` est necessaire : en JavaScript, `null < 0` vaut true.
  return delta !== null && delta < 0
}

export function isBlocked(task: OperationTask): boolean {
  return task.stage_key === 'bloque'
}

// Une tache bloquee ET en retard conserve deux badges, mais un seul bucket, et ce
// bucket est « Interventions » : les badges sont exhaustifs, les sections sont
// exclusives. C'est ce qui permet d'afficher « Bloquee » + « En retard » sur une
// ligne que la priorisation, elle, classe en attente.
export function secondaryBadges(task: OperationTask, today: string): SecondaryBadge[] {
  const badges: SecondaryBadge[] = []
  if (task.stage_key === 'bloque') badges.push('bloquee')
  if (task.stage_key === 'en_validation') badges.push('en_validation')

  const delta = deadlineDelta(task, today)
  if (isDeadlineOverdue(task, today)) badges.push('en_retard')
  else if (delta === null) badges.push('sans_echeance')
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
