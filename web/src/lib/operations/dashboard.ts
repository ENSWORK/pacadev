// Tableau de bord de pilotage - derivation 100 % deterministe, lecture seule.
// Aucun appel IA, aucune valeur inventee : chaque chiffre provient des taches Odoo.
// Regle « decisions cles » validee par l'utilisateur le 2026-09-25 : Odoo n'expose
// aucun tag « Decision », la detection repose donc sur un marqueur explicite dans
// le nom ou la description, jamais sur une interpretation libre.

import { deadlineDelta, isBlocked } from './badges'
// bucketOf est la règle des sections de l'onglet Tâches : la réutiliser ici est ce
// qui garantit que la fenêtre ouverte depuis un KPI affiche le compte du KPI.
// isLate et isDueToday viennent de la même règle : « en retard » et « aujourd'hui »
// doivent avoir un sens unique, sinon la tuile et la section ne peuvent pas
// afficher le même nombre, et un clic ouvrirait une liste différente du chiffre.
import { bucketOf, isDueToday, isLate } from './buckets'
import { ACTION_RULE, LENS_RULE, buildActionQueue, buildLenses, matchesLens } from './lenses'
import {
  STAGE_LABEL,
  TERMINAL_STAGE_KEYS,
  type DashboardBar,
  type DashboardDecision,
  type DashboardFacet,
  type DashboardInitiative,
  type DashboardPayload,
  type DashboardSummary,
  type OperationTask,
  type StageKey,
} from './types'

export const UNASSIGNED_LABEL = 'Non assigné'

export const DASHBOARD_DECISION_LIMIT = 5
export const DASHBOARD_INITIATIVE_LIMIT = 6
export const DASHBOARD_RISK_WINDOW_DAYS = 7

// Une fenêtre d'ouverture montre 10 tâches, puis 10 de plus à la demande, ou
// toute la liste. Jamais les 232 d'un coup.
export const DASHBOARD_FACET_PAGE_SIZE = 10

// Ordre d'affichage des etapes: le flux reel, Termine et acheve restant distincts.
export const STAGE_ORDER: readonly StageKey[] = [
  'reception',
  'a_faire',
  'en_cours',
  'bloque',
  'en_validation',
  'termine',
  'acheve',
  'annule',
  'inconnu',
]

// La charge se mesure sur le travail restant: Termine, Acheve et Annule sont
// exclus du graphique (demande utilisateur du 2026-09-25). Ils restent distincts
// partout ailleurs, notamment dans l'onglet Taches.
export const OPEN_STAGE_ORDER: readonly StageKey[] = STAGE_ORDER.filter(
  (stage) => !TERMINAL_STAGE_KEYS.includes(stage),
)

export const DECISION_PATTERN =
  /(\bd[ée]cider|\bd[ée]cision|\bchoisir|\bchoix|\barbitrer|\barbitrage|\bvalider|\badopter|\badoption|\bbasculer|\bmigrer|\bmigration)/iu

export const DASHBOARD_RULES: DashboardPayload['rules'] = {
  decisions:
    `Tâche racine (hors sous-tâche) dont le nom ou la description contient un marqueur de décision ` +
    `(décider, décision, choisir, choix, arbitrer, valider, adopter, basculer, migrer, migration). ` +
    `Les non terminées d'abord, puis priorité décroissante et échéance la plus proche. ` +
    `${DASHBOARD_DECISION_LIMIT} maximum.`,
  initiatives:
    `Tâche parente d'au moins une sous-tâche et non terminée, triée par nombre de sous-tâches ` +
    `ouvertes puis échéance la plus proche. ${DASHBOARD_INITIATIVE_LIMIT} maximum.`,
  status:
    `Charge par étape : uniquement les étapes encore ouvertes (Réception, À faire, En cours, Bloquée, ` +
    `En validation). « Terminé », « Achevé » et « Annulé » sont exclus du graphique car ils ne sont ` +
    `plus une charge ; ils restent deux étapes distinctes dans l'onglet Tâches et dans l'avancement. ` +
    `Les parts sont calculées sur le total des tâches ouvertes.`,
  load:
    `Une tâche compte pour son premier responsable alphabétique ; les tâches sans responsable sont ` +
    `regroupées sous « ${UNASSIGNED_LABEL} ».`,
  risk:
    `Tâche non terminée de priorité 3 dont l'échéance est dépassée ou arrive sous ` +
    `${DASHBOARD_RISK_WINDOW_DAYS} jours.`,
  completion: `Part des sous-tâches terminées (Terminé, Achevé ou Annulé) sur le total des sous-tâches.`,
  drilldown:
    `Un clic sur une tuile ou une barre ouvre les tâches concernées, ${DASHBOARD_FACET_PAGE_SIZE} ` +
    `à la fois puis 10 de plus ou la liste entière. Même filtre que le chiffre affiché, donc le ` +
    `compte et la liste ne peuvent pas diverger.`,
  lenses: LENS_RULE,
  action: ACTION_RULE,
}

function ratio(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) / 100 : 0
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

function plural(count: number): string {
  return count > 1 ? 's' : ''
}

// Un premier responsable stable: le plus petit alphabétiquement, pour que la
// répartition ne dépende pas de l'ordre de renvoi d'Odoo.
export function primaryAssignee(task: OperationTask): string {
  if (task.assignees.length === 0) return UNASSIGNED_LABEL
  return [...task.assignees].sort((a, b) => a.localeCompare(b, 'fr'))[0]
}

function deadlineRank(task: OperationTask): number {
  if (!task.deadline) return Number.POSITIVE_INFINITY
  const stamp = Date.parse(`${task.deadline}T00:00:00Z`)
  return Number.isNaN(stamp) ? Number.POSITIVE_INFINITY : stamp
}

// Charge par étape: seules les étapes ouvertes sont représentées. Les parts sont
// rapportées au total des tâches ouvertes, pour que la lecture « où se trouve
// la charge » reste juste une fois Terminé/Achevé retirés du graphique.
// `closed` vaut donc toujours 0 ici : une étape terminale n'a plus de barre.
export function buildStageBars(tasks: OperationTask[]): DashboardBar[] {
  const groups = new Map<StageKey, number>()
  let openTotal = 0
  for (const task of tasks) {
    if (task.is_terminal) continue
    openTotal += 1
    groups.set(task.stage_key, (groups.get(task.stage_key) ?? 0) + 1)
  }
  const bars: DashboardBar[] = []
  for (const stage of OPEN_STAGE_ORDER) {
    const count = groups.get(stage) ?? 0
    if (count === 0) continue
    bars.push({
      key: stage,
      label: STAGE_LABEL[stage],
      count,
      share: ratio(count, openTotal),
      closed: 0,
    })
  }
  return bars
}

export function buildAssigneeBars(
  tasks: OperationTask[],
  scope: 'all' | 'open',
): DashboardBar[] {
  const groups = new Map<string, { count: number; closed: number }>()
  for (const task of tasks) {
    if (scope === 'open' && task.is_terminal) continue
    const key = primaryAssignee(task)
    const entry = groups.get(key) ?? { count: 0, closed: 0 }
    entry.count += 1
    if (task.is_terminal) entry.closed += 1
    groups.set(key, entry)
  }
  const total = Array.from(groups.values()).reduce((sum, entry) => sum + entry.count, 0)
  return Array.from(groups.entries())
    .map(([key, entry]) => ({
      key,
      label: key,
      count: entry.count,
      share: ratio(entry.count, total),
      closed: entry.closed,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
}

export function isDecisionCandidate(task: OperationTask): boolean {
  // une sous-tache ne peut pas etre une decision de pilotage
  if (task.parent_id !== null) return false
  return DECISION_PATTERN.test(task.name) || DECISION_PATTERN.test(task.description_excerpt)
}

export function buildDecisions(
  tasks: OperationTask[],
  limit: number = DASHBOARD_DECISION_LIMIT,
): DashboardDecision[] {
  return tasks
    .filter(isDecisionCandidate)
    .sort((a, b) => {
      if (a.is_terminal !== b.is_terminal) return a.is_terminal ? 1 : -1
      if (a.priority !== b.priority) return b.priority - a.priority
      const ra = deadlineRank(a)
      const rb = deadlineRank(b)
      if (ra !== rb) return ra - rb
      return a.id - b.id
    })
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      ref: task.ref,
      name: task.name,
      stage_key: task.stage_key,
      deadline: task.deadline,
      priority: task.priority,
      assignees: task.assignees,
      is_open: !task.is_terminal,
    }))
}

export function buildInitiatives(
  tasks: OperationTask[],
  limit: number = DASHBOARD_INITIATIVE_LIMIT,
): DashboardInitiative[] {
  const children = new Map<number, OperationTask[]>()
  for (const task of tasks) {
    if (task.parent_id === null) continue
    const list = children.get(task.parent_id) ?? []
    list.push(task)
    children.set(task.parent_id, list)
  }

  const initiatives: DashboardInitiative[] = []
  for (const task of tasks) {
    const list = children.get(task.id)
    if (!list || list.length === 0) continue
    // un chantier clot n'est plus un effort a piloter
    if (task.is_terminal) continue
    const done = list.filter((child) => child.is_terminal).length
    initiatives.push({
      id: task.id,
      ref: task.ref,
      name: task.name,
      stage_key: task.stage_key,
      deadline: task.deadline,
      assignees: task.assignees,
      tags: task.tags,
      children: list.length,
      children_done: done,
      children_open: list.length - done,
      completion: ratio(done, list.length),
    })
  }

  return initiatives
    .sort((a, b) => {
      if (a.children_open !== b.children_open) return b.children_open - a.children_open
      const ra = a.deadline === null ? Number.POSITIVE_INFINITY : Date.parse(`${a.deadline}T00:00:00Z`)
      const rb = b.deadline === null ? Number.POSITIVE_INFINITY : Date.parse(`${b.deadline}T00:00:00Z`)
      if (ra !== rb) return ra - rb
      return a.id - b.id
    })
    .slice(0, limit)
}

export function buildSummary(tasks: OperationTask[], today: string): DashboardSummary {
  const total = tasks.length
  const open = tasks.filter((task) => !task.is_terminal).length
  const done = total - open
  const late = tasks.filter((task) => isLate(task, today)).length
  const dueToday = tasks.filter((task) => isDueToday(task, today)).length
  const atRisk = tasks.filter((task) => {
    if (task.is_terminal || task.priority !== 3) return false
    const delta = deadlineDelta(task, today)
    return delta !== null && delta <= DASHBOARD_RISK_WINDOW_DAYS
  }).length
  const blocked = tasks.filter(isBlocked).length
  const inValidation = tasks.filter((task) => task.stage_key === 'en_validation').length
  const unassigned = tasks.filter((task) => task.assignees.length === 0).length
  const subtasks = tasks.filter((task) => task.parent_id !== null).length
  const parents = new Set(tasks.map((task) => task.parent_id).filter((id) => id !== null)).size

  const candidates = tasks.filter(isDecisionCandidate)
  const decisionsOpen = candidates.filter((task) => !task.is_terminal).length
  // le total réel des chantiers ouverts, pas la length du bloc plafonné à 6
  const initiativesOpen = buildInitiatives(tasks, Number.MAX_SAFE_INTEGER).length

  const load = buildAssigneeBars(tasks, 'all').filter((bar) => bar.key !== UNASSIGNED_LABEL)
  const leader = load[0] ?? null
  const top = buildInitiatives(tasks, 1)[0] ?? null

  const lines = [
    `Périmètre : ${total} tâche${plural(total)} active${plural(total)} — ${open} ouverte${plural(open)}, ` +
      `${done} terminée${plural(done)} (${percent(done, total)} %), dont ${subtasks} sous-tâche${plural(subtasks)} ` +
      `repartie${plural(subtasks)} sous ${parents} initiative${plural(parents)}.`,
    `Urgence : ${late} en retard, ${dueToday} avec échéance aujourd'hui et ${atRisk} à risque ` +
      `(priorité 3 à J+${DASHBOARD_RISK_WINDOW_DAYS} ou échéance dépassée).`,
    `Blocages : ${blocked} tâche${plural(blocked)} bloquée${plural(blocked)}, ${inValidation} en validation ; ` +
      `${unassigned} sans responsable (${percent(unassigned, total)} % du périmètre).`,
    leader
      ? `Charge : ${leader.label} porte le plus de tâches (${leader.count}, ${percent(leader.count, total)} % ` +
          `du total) ; ${decisionsOpen} décision${plural(decisionsOpen)} clé${plural(decisionsOpen)} ` +
          `encore ouverte${plural(decisionsOpen)} sur ${candidates.length} identifiée${plural(candidates.length)}.`
      : `Charge : aucune tâche n'a de responsable renseigné ; ${decisionsOpen} décision${plural(decisionsOpen)} ` +
          `clé${plural(decisionsOpen)} encore ouverte${plural(decisionsOpen)} sur ${candidates.length} identifiée${plural(candidates.length)}.`,
    top
      ? `Priorité : ${top.name} est le chantier le plus lourd — ${top.children_open} sous-tâche${plural(top.children_open)} ` +
          `ouverte${plural(top.children_open)} sur ${top.children}.`
      : `Priorité : aucun chantier parent en cours — toutes les tâches sont isolées ou terminées.`,
  ]

  return {
    lines,
    total,
    open,
    done,
    late,
    due_today: dueToday,
    at_risk: atRisk,
    blocked,
    in_validation: inValidation,
    unassigned,
    subtasks,
    parents,
    decisions_total: candidates.length,
    decisions_open: decisionsOpen,
    initiatives_open: initiativesOpen,
    completion: ratio(done, total),
    top_assignee: leader ? leader.label : null,
    top_assignee_count: leader ? leader.count : 0,
  }
}

export function buildDashboard(tasks: OperationTask[], today: string): DashboardPayload {
  return {
    summary: buildSummary(tasks, today),
    by_stage: buildStageBars(tasks),
    by_assignee_total: buildAssigneeBars(tasks, 'all'),
    by_assignee_open: buildAssigneeBars(tasks, 'open'),
    decisions: buildDecisions(tasks),
    initiatives: buildInitiatives(tasks),
    lenses: buildLenses(tasks),
    action_queue: buildActionQueue(tasks, today),
    rules: DASHBOARD_RULES,
  }
}

// ── Ouverture d'un segment ─────────────────────────────────────────────────
// La liste affichée dans la fenêtre est produite par le même filtre que le
// chiffre de la tuile : c'est la garantie qu'un clic n'affichera jamais un
// compte différent de celui annoncé sur le tableau de bord.

export const FACET_LABEL: Record<DashboardFacet['kind'], string> = {
  open: 'Tâches ouvertes',
  late: 'Tâches en retard',
  blocked: 'Tâches bloquées',
  unassigned: 'Tâches sans responsable',
  decisions: 'Décisions à prendre',
  initiatives: 'Initiatives en cours',
  stage: 'Tâches à l’étape',
  assignee: 'Charge d’un responsable',
  total: 'Toutes les tâches',
  bucket: 'Tâches de la section',
  lens: 'Loupe',
}

// Identité textuelle d'un segment: sert de clé React pour que la fenêtre
// reparte de 10 tâches à chaque ouverture, sans état à synchroniser.
export function facetKey(facet: DashboardFacet): string {
  switch (facet.kind) {
    case 'stage':
      return `stage:${facet.key}`
    case 'assignee':
      return `assignee:${facet.key}:${facet.openOnly ? 'open' : 'all'}`
    case 'bucket':
      return `bucket:${facet.bucket}`
    case 'lens':
      return `lens:${facet.lens}`
    default:
      return facet.kind
  }
}

export function selectFacet(
  tasks: OperationTask[],
  facet: DashboardFacet,
  today: string,
): OperationTask[] {
  const parentIds = new Set(
    tasks.filter((task) => task.parent_id !== null).map((task) => task.parent_id as number),
  )
  const matched = tasks.filter((task) => {
    switch (facet.kind) {
      case 'open':
        return !task.is_terminal
      case 'late':
        return isLate(task, today)
      case 'blocked':
        return isBlocked(task)
      case 'unassigned':
        return task.assignees.length === 0
      case 'decisions':
        return isDecisionCandidate(task) && !task.is_terminal
      case 'initiatives':
        return !task.is_terminal && parentIds.has(task.id)
      case 'stage':
        return task.stage_key === facet.key
      case 'assignee':
        return (
          primaryAssignee(task) === facet.key && (!facet.openOnly || !task.is_terminal)
        )
      case 'total':
        return true
      case 'bucket':
        return bucketOf(task, today) === facet.bucket
      case 'lens':
        return matchesLens(task, facet.lens)
    }
  })
  // tri de pilotage: non terminées d'abord, puis priorité, puis échéance la
  // plus proche — le même ordre que les décisions clés, donc lisible partout.
  return matched.sort((a, b) => {
    if (a.is_terminal !== b.is_terminal) return a.is_terminal ? 1 : -1
    if (a.priority !== b.priority) return b.priority - a.priority
    const ra = deadlineRank(a)
    const rb = deadlineRank(b)
    if (ra !== rb) return ra - rb
    return a.id - b.id
  })
}
