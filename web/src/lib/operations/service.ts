// Service du cockpit operations: selection de source, fraicheur, assemblage du payload

import { assignBuckets, computeKpis } from './buckets'
import { readHistorySeries, type HistorySeries } from './history-source'
import { buildDashboard } from './dashboard'
import { buildOdooConfig, createOdooSource, OdooSourceError } from './odoo-source'
import { createProjectionSource, resolveProjectionPath, type SourceSnapshot, type TaskSource } from './projection-source'
import { ageSeconds, OPERATIONS_TIMEZONE, todayIso } from './time'
import type { Freshness, OperationsHistory, OperationsPayload, TaskSourceName } from './types'

export const STALE_MINUTES_DEFAULT = 60

/** Nombre de jours d'historique avant de parler de tendance. Trois points
 *  aligns ne sont pas une evolution, ils sont du bruit. */
export const TREND_MIN_DAYS = 14

/** Converture de l'historique en payload, avec la raison de l'indisponibilite.
 *  Une serie absente est un etat normal les premiers jours : le cockpit ne doit
 *  pas la traiter comme une panne. */
export function buildHistory(
  serie: HistorySeries,
  trendMinDays: number = TREND_MIN_DAYS,
  /** Raison imposee quand aucune archive n'a ete lue : `history: false` ne doit
   *  pas laisser croire qu'aucune archive n'existe. */
  raisonVide: string | null = null,
): OperationsHistory {
  const points = serie.points.map((point) => ({
    date: point.date,
    total: point.total,
    done: point.done,
    open: point.open,
    late: point.late,
    by_stage: point.by_stage,
  }))

  // `coverage` va du premier point a aujourd'hui, `span` du premier au dernier :
  // les deux sont egaux exactement quand le dernier point est celui d'aujourd'hui.
  // Comparer `span` au seuil ne marche pas - 14 points quotidiens ne couvrent que
  // 13 intervalles, donc une serie parfaitement a jour serait refusee a un jour pres.
  const bloquant: string | null =
    serie.points.length === 0
      ? raisonVide
        ?? (serie.skipped.length > 0
          ? 'Aucune archive lisible : toutes les archives présentes ont été rejetées.'
          : 'Aucune archive pour l’instant. La première est écrite au prochain passage du job.')
      : serie.days_covered < trendMinDays
        ? `${serie.days_covered} jour(s) d’historique, ${trendMinDays} requis avant toute tendance.`
        : serie.coverage > serie.span // serie arretee : le dernier point n'est pas celui d'aujourd'hui
          ? `Série arrêtée au ${serie.last_date}, sans point aujourd’hui.`
          : null

  return {
    points,
    first_date: serie.first_date,
    last_date: serie.last_date,
    coverage: serie.coverage,
    span: serie.span,
    days_covered: serie.days_covered,
    trend_ready: bloquant === null,
    trend_min_days: trendMinDays,
    trend_blocked_by: bloquant,
    skipped: serie.skipped.map((entree) => ({ ...entree })),
  }
}

const HISTORIQUE_NON_DEMANDE_RAISON = 'Historique non demandé par ce cockpit.'

/** Serie vide : point de depart de `history: false`, qui ne lit aucun fichier
 *  sur disque et ne pretend donc rien des archives reellement presentes. */
const HISTORIQUE_NON_DEMANDE: HistorySeries = {
  points: [],
  skipped: [],
  first_date: null,
  last_date: null,
  coverage: 0,
  span: 0,
  days_covered: 0,
}

export const CLICKUP_PARITY_REASON =
  'Parité ClickUp indisponible : la rotation du token API ClickUp n’est pas faite. ' +
  'Aucune comparaison ClickUp n’est effectuée et aucune donnée Odoo n’est masquée.'

export function staleAfterSeconds(raw: string | undefined, env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number.parseInt((raw ?? env.OPERATIONS_TASKS_STALE_MINUTES ?? '').trim(), 10)
  const minutes = Number.isFinite(configured) && configured > 0 ? configured : STALE_MINUTES_DEFAULT
  return minutes * 60
}

export function buildFreshness(
  snapshot: SourceSnapshot,
  source: TaskSourceName,
  now: Date,
  staleSeconds: number,
): Freshness {
  const age = ageSeconds(snapshot.generated_at, now)
  const unknown = !Number.isFinite(age)
  return {
    source,
    generated_at: snapshot.generated_at,
    age_seconds: unknown ? 0 : age,
    // fraicheur inconnue => donnee consideree obsolete (jamais presumee recente)
    stale: unknown || age > staleSeconds,
    stale_after_seconds: staleSeconds,
    detail: snapshot.detail,
  }
}

export interface LoadOperationsOptions {
  now?: Date
  env?: NodeJS.ProcessEnv
  cwd?: string
  /** Désactive la lecture de l'historique, pour un cockpit qui ne fait que lire
   *  la projection courante. */
  history?: boolean
}

export interface LoadedOperations {
  payload: OperationsPayload
  source: TaskSource
  sourceName: TaskSourceName
  fallbackDetail: string | null
}

async function loadSnapshot(
  preferred: TaskSource | null,
  fallback: TaskSource | null,
): Promise<{ snapshot: SourceSnapshot; source: TaskSource; detail: string | null }> {
  let detail: string | null = null
  if (preferred) {
    try {
      const snapshot = await preferred.load()
      return { snapshot, source: preferred, detail: null }
    } catch (error) {
      if (!fallback) throw error
      const reason = error instanceof OdooSourceError
        ? error.message
        : (error as Error).message
      detail = `Source Odoo JSON-2 indisponible (${reason}), repli sur la projection`
    }
  }
  const snapshot = await (fallback as TaskSource).load()
  return { snapshot, source: fallback as TaskSource, detail }
}

export async function loadOperations(
  options: LoadOperationsOptions = {},
): Promise<LoadedOperations> {
  const env = options.env ?? process.env
  const now = options.now ?? new Date()
  const cwd = options.cwd ?? process.cwd()
  const today = todayIso(now, OPERATIONS_TIMEZONE)

  const odooConfig = buildOdooConfig(env)
  const preferred = odooConfig ? createOdooSource(odooConfig) : null
  const fallback = createProjectionSource({ path: resolveProjectionPath(cwd, env) })

  const { snapshot, source, detail } = await loadSnapshot(preferred, fallback)
  const freshness = buildFreshness(snapshot, source.name, now, staleAfterSeconds(undefined, env))
  const { buckets, unclassified } = assignBuckets(snapshot.tasks, today)

  const payload: OperationsPayload = {
    read_only: true,
    today,
    timezone: OPERATIONS_TIMEZONE,
    tasks: snapshot.tasks,
    buckets,
    unclassified,
    kpis: computeKpis(buckets, snapshot.tasks.length),
    dashboard: buildDashboard(snapshot.tasks, today),
    freshness,
    history: options.history === false
      ? buildHistory(HISTORIQUE_NON_DEMANDE, TREND_MIN_DAYS, HISTORIQUE_NON_DEMANDE_RAISON)
      : buildHistory(readHistorySeries({ cwd, env, now: () => now.getTime() })),
    clickup_parity: {
      available: false,
      reason: CLICKUP_PARITY_REASON,
    },
  }

  return { payload, source, sourceName: source.name, fallbackDetail: detail }
}
