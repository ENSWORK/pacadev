// Source projection: lecture du fichier JSON genere, avec cache court

import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { normalizeStageMap, normalizeTasks, ProjectionError } from './normalize'
import type { OperationTask, StageKey, TaskSourceName } from './types'

export const DEFAULT_PROJECTION_PATH = '.data/operations-tasks.json'
export const PROJECTION_CACHE_MS = 60_000
export const PROJECTION_SCHEMA_VERSION = 1

export interface SourceSnapshot {
  tasks: OperationTask[]
  generated_at: string
  stage_map: Record<number, StageKey>
  detail: string | null
}

export interface TaskSource {
  readonly name: TaskSourceName
  load(now?: Date): Promise<SourceSnapshot>
}

interface CachedSnapshot {
  at: number
  value: SourceSnapshot
}

let cache: CachedSnapshot | null = null

export function resetProjectionCache(): void {
  cache = null
}

export function resolveProjectionPath(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env.OPERATIONS_TASKS_PROJECTION_PATH ?? '').trim()
  const target = configured.length > 0 ? configured : DEFAULT_PROJECTION_PATH
  return isAbsolute(target) ? target : resolve(cwd, target)
}

export function readProjectionFile(path: string): SourceSnapshot {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new ProjectionError('missing', path, `Projection introuvable : ${path}`)
    }
    throw new ProjectionError('corrupt', path, `Projection illisible : ${path}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new ProjectionError(
      'corrupt',
      path,
      `Projection corrompue (JSON invalide) : ${path} - ${(error as Error).message}`,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProjectionError('corrupt', path, `Projection corrompue (racine invalide) : ${path}`)
  }

  const header = parsed as Record<string, unknown>
  const version = header.schema_version
  if (version !== undefined && version !== PROJECTION_SCHEMA_VERSION) {
    throw new ProjectionError(
      'schema',
      path,
      `Version de projection non supportée : ${String(version)} (attendu ${PROJECTION_SCHEMA_VERSION})`,
    )
  }

  const { tasks, rejected } = normalizeTasks(header.tasks)
  if (tasks.length === 0 && rejected > 0) {
    throw new ProjectionError('corrupt', path, `Projection corrompue : ${rejected} tâche(s) illisible(s)`)
  }

  return {
    tasks,
    generated_at: typeof header.generated_at === 'string' ? header.generated_at : '',
    stage_map: normalizeStageMap(header.stage_map),
    detail: rejected > 0 ? `${rejected} tâche(s) ignorée(s) à la normalisation` : null,
  }
}

export interface ProjectionSourceOptions {
  path?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  now?: () => number
  cacheMs?: number
}

export function createProjectionSource(options: ProjectionSourceOptions = {}): TaskSource {
  const now = options.now ?? Date.now
  const cacheMs = options.cacheMs ?? PROJECTION_CACHE_MS
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env

  return {
    name: 'projection',
    async load(): Promise<SourceSnapshot> {
      const at = now()
      if (cache && at - cache.at < cacheMs) return cache.value
      const value = readProjectionFile(options.path ?? resolveProjectionPath(cwd, env))
      cache = { at, value }
      return value
    },
  }
}
