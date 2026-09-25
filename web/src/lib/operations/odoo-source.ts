// Source Odoo JSON-2 - lecture seule, active uniquement si ODOO_TASKS_API_KEY est renseignee

import { normalizeTask, stageKeyFromId } from './normalize'
import type { TaskSource } from './projection-source'
import type { OperationTask, TaskSourceName } from './types'

export const ODOO_TASK_MODEL = 'project.task'
export const ODOO_DEFAULT_PAGE_SIZE = 200
export const ODOO_DEFAULT_TIMEOUT_MS = 15_000
export const ODOO_MAX_PAGES = 50

const TASK_FIELDS = [
  'name',
  'stage_id',
  'date_deadline',
  'priority',
  'user_ids',
  'tag_ids',
  'parent_id',
  'description',
  'active',
]

const RECURRING_TAG = /r[ée]curr/i
const RECURRING_TEXT = /t[aâ]che r[ée]currente/i

export interface OdooSourceConfig {
  url: string
  database: string
  apiKey: string
  pageSize: number
  timeoutMs: number
  fetchImpl: typeof fetch
}

export class OdooSourceError extends Error {
  readonly detail: string

  constructor(message: string, detail: string) {
    super(message)
    this.name = 'OdooSourceError'
    this.detail = detail
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function readNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// `X-Openerp-Session-Id` porte l'identifiant de base, conformement au
// contrat de headers retenu pour cette source (a confirmer des la premiere
// connexion reelle: la source reste inactive tant que la cle n'est pas posee).
export function buildOdooConfig(env: NodeJS.ProcessEnv = process.env): OdooSourceConfig | null {
  const apiKey = (env.ODOO_TASKS_API_KEY ?? '').trim()
  if (apiKey.length === 0) return null
  const url = trimTrailingSlash((env.ODOO_TASKS_URL ?? '').trim())
  if (url.length === 0) return null
  return {
    url,
    database: (env.ODOO_TASKS_DB ?? '').trim(),
    apiKey,
    pageSize: readNumberEnv(env.ODOO_TASKS_PAGE_SIZE, ODOO_DEFAULT_PAGE_SIZE),
    timeoutMs: readNumberEnv(env.ODOO_TASKS_TIMEOUT_MS, ODOO_DEFAULT_TIMEOUT_MS),
    fetchImpl: globalThis.fetch,
  }
}

function endpoint(config: OdooSourceConfig, model: string, method: string): string {
  return `${config.url}/json/2/${config.database}/${model}/${method}`
}

function headersFor(config: OdooSourceConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'X-Openerp-Session-Id': config.database,
  }
}

async function call(
  config: OdooSourceConfig,
  model: string,
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await config.fetchImpl(endpoint(config, model, method), {
    method: 'POST',
    headers: headersFor(config),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) {
    throw new OdooSourceError(
      `Odoo JSON-2 : HTTP ${response.status} sur ${model}/${method}`,
      await response.text().catch(() => ''),
    )
  }
  return response.json()
}

function asRows(result: unknown): Record<string, unknown>[] {
  if (!Array.isArray(result)) return []
  return result.filter(
    (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
  )
}

function manyToOneId(value: unknown): number | null {
  if (Array.isArray(value)) {
    const first = value[0]
    const parsed = typeof first === 'number' ? first : Number.parseInt(String(first ?? ''), 10)
    return Number.isInteger(parsed) ? parsed : null
  }
  if (typeof value === 'number' && Number.isInteger(value)) return value
  return null
}

function idList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  for (const entry of value) {
    if (typeof entry === 'number' && Number.isInteger(entry)) ids.push(entry)
  }
  return ids
}

async function resolveNames(
  config: OdooSourceConfig,
  model: string,
  ids: number[],
  field: string,
): Promise<Map<number, string>> {
  const labels = new Map<number, string>()
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return labels
  const result = await call(config, model, 'search_read', {
    domain: [['id', 'in', unique]],
    fields: [field],
    limit: unique.length,
  })
  for (const row of asRows(result)) {
    const id = row.id
    const label = row[field]
    if (typeof id === 'number' && typeof label === 'string') labels.set(id, label)
  }
  return labels
}

function mapRow(
  row: Record<string, unknown>,
  userLabels: Map<number, string>,
  tagLabels: Map<number, string>,
): OperationTask | null {
  const description = typeof row.description === 'string' ? row.description : ''
  const tagNames = idList(row.tag_ids).map((id) => tagLabels.get(id) ?? `#${id}`)
  const normalized = normalizeTask({
    id: row.id,
    name: row.name,
    stage_id: manyToOneId(row.stage_id),
    stage_key: stageKeyFromId(manyToOneId(row.stage_id) ?? -1),
    deadline: row.date_deadline,
    priority: row.priority,
    assignees: idList(row.user_ids).map((id) => userLabels.get(id) ?? `#${id}`),
    tags: tagNames,
    parent_id: manyToOneId(row.parent_id),
    description_excerpt: description,
    active: row.active,
    is_recurring:
      tagNames.some((tag) => RECURRING_TAG.test(tag)) || RECURRING_TEXT.test(description),
  })
  return normalized
}

export function createOdooSource(config: OdooSourceConfig, name: TaskSourceName = 'odoo-json2') {
  const source: TaskSource = {
    name,
    async load(now: Date = new Date()) {
      const rows: Record<string, unknown>[] = []
      for (let page = 0; page < ODOO_MAX_PAGES; page += 1) {
        const result = await call(config, ODOO_TASK_MODEL, 'search_read', {
          domain: [],
          fields: TASK_FIELDS,
          order: 'id asc',
          limit: config.pageSize,
          offset: page * config.pageSize,
        })
        const batch = asRows(result)
        rows.push(...batch)
        if (batch.length < config.pageSize) break
      }

      const userLabels = await resolveNames(
        config,
        'res.users',
        rows.flatMap((row) => idList(row.user_ids)),
        'name',
      )
      const tagLabels = await resolveNames(
        config,
        'project.tags',
        rows.flatMap((row) => idList(row.tag_ids)),
        'name',
      )

      const mapped = rows
        .map((row) => mapRow(row, userLabels, tagLabels))
        .filter((task): task is OperationTask => task !== null)

      return {
        tasks: mapped,
        generated_at: now.toISOString(),
        stage_map: {},
        detail: `lecture directe Odoo (${mapped.length} tâche(s))`,
      }
    },
  }
  return source
}
