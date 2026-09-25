// Service du cockpit operations: selection de source, fraicheur, assemblage du payload

import { assignBuckets, computeKpis } from './buckets'
import { buildDashboard } from './dashboard'
import { buildOdooConfig, createOdooSource, OdooSourceError } from './odoo-source'
import { createProjectionSource, resolveProjectionPath, type SourceSnapshot, type TaskSource } from './projection-source'
import { ageSeconds, OPERATIONS_TIMEZONE, todayIso } from './time'
import type { Freshness, OperationsPayload, TaskSourceName } from './types'

export const STALE_MINUTES_DEFAULT = 60

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
    clickup_parity: {
      available: false,
      reason: CLICKUP_PARITY_REASON,
    },
  }

  return { payload, source, sourceName: source.name, fallbackDetail: detail }
}
