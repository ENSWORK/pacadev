// Cockpit operations PACADAI - modele de domaine (lecture seule stricte)

export type StageKey =
  | 'reception'
  | 'a_faire'
  | 'en_cours'
  | 'bloque'
  | 'en_validation'
  | 'termine'
  | 'annule'
  | 'acheve'
  | 'inconnu'

// etapes reelles du projet Odoo 1 - source de verite metier
export const STAGE_KEY_BY_ID: Record<number, StageKey> = {
  1: 'reception',
  8: 'a_faire',
  9: 'en_cours',
  10: 'bloque',
  11: 'en_validation',
  12: 'termine',
  13: 'annule',
  20: 'acheve',
}

// `acheve` et `termine` sont deux etapes distinctes: jamais fusionnees
export const STAGE_LABEL: Record<StageKey, string> = {
  reception: 'Réception',
  a_faire: 'À faire',
  en_cours: 'En cours',
  bloque: 'Bloquée',
  en_validation: 'En validation',
  termine: 'Terminé',
  annule: 'Annulé',
  acheve: 'Achevé',
  inconnu: 'Étape inconnue',
}

export const TERMINAL_STAGE_KEYS: readonly StageKey[] = ['acheve', 'termine', 'annule']

export type TaskBucket =
  | 'done'
  | 'late'
  | 'today'
  | 'intervention'
  | 'a_planifier'
  | 'j14'
  | 'plus_tard'

export type TaskPriority = 0 | 1 | 2 | 3

export interface OperationTask {
  id: number
  ref: string
  name: string
  stage_id: number
  stage_key: StageKey
  is_terminal: boolean
  deadline: string | null
  priority: number
  assignees: string[]
  tags: string[]
  parent_id: number | null
  clickup_ref: string | null
  github_ref: string | null
  is_recurring: boolean
  active: boolean
  description_excerpt: string
  clickup_id: string | null
  github_issue: number | null
}

export type TaskSourceName = 'projection' | 'odoo-json2'

export interface Freshness {
  source: TaskSourceName
  generated_at: string
  age_seconds: number
  stale: boolean
  stale_after_seconds: number
  detail: string | null
}

export interface OperationsKpis {
  total: number
  done: number
  late: number
  today: number
  intervention: number
  a_planifier: number
  j14: number
}

// ── Tableau de bord de pilotage ────────────────────────────────────────────
// Tout est derivé des tâches par `lib/operations/dashboard.ts` : aucune valeur
// saisie, aucun appel externe. Les règles affichées tracent le mode de calcul.

export interface DashboardBar {
  key: string
  label: string
  count: number
  /** part du total du graphique, entre 0 et 1 */
  share: number
  /** tâches terminées à l'intérieur du groupe */
  closed: number
}

export interface DashboardDecision {
  id: number
  ref: string
  name: string
  stage_key: StageKey
  deadline: string | null
  priority: number
  assignees: string[]
  is_open: boolean
}

export interface DashboardInitiative {
  id: number
  ref: string
  name: string
  stage_key: StageKey
  deadline: string | null
  assignees: string[]
  tags: string[]
  children: number
  children_done: number
  children_open: number
  /** part des sous-tâches terminées, entre 0 et 1 */
  completion: number
}

export interface DashboardSummary {
  lines: string[]
  total: number
  open: number
  done: number
  late: number
  due_today: number
  at_risk: number
  blocked: number
  in_validation: number
  unassigned: number
  subtasks: number
  parents: number
  decisions_total: number
  decisions_open: number
  /** chantiers parents encore ouverts, tous confondus (le bloc n'en montre que 6) */
  initiatives_open: number
  completion: number
  top_assignee: string | null
  top_assignee_count: number
}

// ── Ouverture d'un segment vers la liste des tâches sous-jacentes ───────────
// Un clic sur une tuile ou une barre ouvre les tâches concernées. La sélection
// est un simple filtre sur la projection déjà chargée : aucun appel réseau, donc
// le compte affiché et la liste ouverte ne peuvent pas diverger.
export type DashboardFacet =
  | { kind: 'open' }
  | { kind: 'late' }
  | { kind: 'blocked' }
  | { kind: 'unassigned' }
  | { kind: 'decisions' }
  | { kind: 'initiatives' }
  | { kind: 'stage'; key: StageKey }
  | { kind: 'assignee'; key: string; openOnly: boolean }

export interface DashboardRules {
  decisions: string
  initiatives: string
  status: string
  load: string
  risk: string
  completion: string
  drilldown: string
}

export interface DashboardPayload {
  summary: DashboardSummary
  by_stage: DashboardBar[]
  by_assignee_total: DashboardBar[]
  by_assignee_open: DashboardBar[]
  decisions: DashboardDecision[]
  initiatives: DashboardInitiative[]
  rules: DashboardRules
}

export interface OperationsPayload {
  read_only: true
  today: string
  timezone: string
  tasks: OperationTask[]
  buckets: Record<TaskBucket, OperationTask[]>
  unclassified: OperationTask[]
  kpis: OperationsKpis
  dashboard: DashboardPayload
  freshness: Freshness
  clickup_parity: {
    available: false
    reason: string
  }
}
