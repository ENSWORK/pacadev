// Loupes et file d'action du cockpit Operations - derivation 100 % deterministe.
//
// Une loupe n'est pas une section. Les sections de l'onglet Tâches rangent
// chaque tâche dans UNE seule colonne ; une loupe regarde un AUTRE axe et se
// superpose donc aux sections. C'est délibéré : « sans responsable » ne
// remplace pas « en retard », une tâche peut être les deux, et l'utilisateur a
// validé qu'on le voie.
//
// Deux règles que ce fichier tient à écrire exactement :
// - les loupes ne comptent que les tâches NON terminées. Une tâche terminée
//   n'a plus rien à piloter ; la compter ici gonflerait le chiffre sans jamais
//   dire quoi en faire ;
// - la file d'action trie par échéance, PAS par priorité. C'est la décision
//   utilisateur du 2026-09-27 (« urgence d'abord »), et elle a une conséquence
//   assumée : à échéance égale, c'est l'identifiant qui départage, donc
//   odoo:30 (priorité 0) entre dans la file tandis que odoo:123 (priorité 1)
//   reste dehors. Le Priorité reste une information affichée sur la ligne.

import { diffIsoDays } from './time'
import type { DashboardAction, DashboardLens, OperationTask, TaskLens } from './types'

export const LENS_ORDER: readonly TaskLens[] = [
  'non_assignee',
  'recurrente',
  'bloque',
  'en_validation',
]

export const LENS_LABEL: Record<TaskLens, string> = {
  non_assignee: 'Sans responsable',
  recurrente: 'Récurrentes',
  bloque: 'Bloquées',
  en_validation: 'En validation',
}

export const LENS_HINT: Record<TaskLens, string> = {
  non_assignee:
    'Tâches non terminées sans aucun responsable. Le compteur du résumé inclut ' +
    'aussi les tâches terminées : il est donc plus grand que celui de cette loupe.',
  recurrente:
    'Tâches non terminées identifiées comme récurrentes (marqueur dans le nom ou la ' +
    'description). Odoo n’expose aucune fréquence : impossible de dire si une récurrence ' +
    'est respectée.',
  bloque: "Tâches non terminées à l'étape Bloquée. Toute l'échéance est ignorée ici.",
  en_validation:
    "Tâches non terminées à l'étape En validation. Ces tâches attendent une décision " +
    'humaine : les compter comme « en retard » serait un faux signal.',
}

// La file d'action est courte par construction : au-delà de cinq lignes, elle
// cesse d'être une file et devient une liste de tâches.
export const ACTION_QUEUE_LIMIT = 5

export const LENS_RULE =
  'Loupes : quatre axes qui se superposent aux sections de l’onglet Tâches, et ne comptent ' +
  'que les tâches non terminées. « Sans responsable » et « Récurrentes » se lisent avec le ' +
  'badge de la ligne ; « Bloquées » et « En validation » reprennent l’étape réelle affichée ' +
  'sur la tâche.'

export const ACTION_RULE =
  `File d'action : les ${ACTION_QUEUE_LIMIT} tâches non terminées dont l'échéance est la ` +
  'plus ancienne, les tâches sans échéance venant après toutes les autres. À échéance ' +
  'égale, le départage est l’identifiant de la tâche, donc l’ordre est stable d’un jour à ' +
  "l'autre. La priorité n'entre pas dans le tri : une tâche ancienne la bat toujours, même " +
  'de priorité 0.'

export function matchesLens(task: OperationTask, lens: TaskLens): boolean {
  // Une tâche terminée n'est jamais dans une loupe : il n'y a rien à piloter.
  if (task.is_terminal) return false
  switch (lens) {
    case 'non_assignee':
      return task.assignees.length === 0
    case 'recurrente':
      return task.is_recurring
    case 'bloque':
      return task.stage_key === 'bloque'
    case 'en_validation':
      return task.stage_key === 'en_validation'
  }
}

export function buildLenses(tasks: OperationTask[]): DashboardLens[] {
  return LENS_ORDER.map((lens) => ({
    lens,
    label: LENS_LABEL[lens],
    count: tasks.filter((task) => matchesLens(task, lens)).length,
    hint: LENS_HINT[lens],
  }))
}

export function selectLens(tasks: OperationTask[], lens: TaskLens): OperationTask[] {
  return tasks.filter((task) => matchesLens(task, lens))
}

// Jours de retard : positif quand l'échéance est dépassée, 0 sinon.
export function overdueDays(task: OperationTask, today: string): number {
  if (!task.deadline) return 0
  const delta = diffIsoDays(today, task.deadline)
  return Number.isFinite(delta) && delta < 0 ? -delta : 0
}

export function buildActionQueue(
  tasks: OperationTask[],
  today: string,
  limit: number = ACTION_QUEUE_LIMIT,
): DashboardAction[] {
  return tasks
    .filter((task) => !task.is_terminal)
    .sort((a, b) => {
      // Sans échéance en dernier : une tâche sans date n'est pas urgente, elle
      // est surtout non datée - et la section « Sans échéance » la montre déjà.
      const da = a.deadline
      const db = b.deadline
      if (da === null && db !== null) return 1
      if (da !== null && db === null) return -1
      if (da !== null && db !== null && da !== db) return da < db ? -1 : 1
      return a.id - b.id
    })
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      ref: task.ref,
      name: task.name,
      stage_key: task.stage_key,
      deadline: task.deadline,
      overdue_days: overdueDays(task, today),
      priority: task.priority,
      assignees: task.assignees,
      is_recurring: task.is_recurring,
    }))
}
