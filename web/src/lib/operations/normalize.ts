// Normalisation des taches Odoo vers le modele du cockpit

import { isIsoDate } from './time'
import {
  STAGE_KEY_BY_ID,
  TERMINAL_STAGE_KEYS,
  type OperationTask,
  type StageKey,
} from './types'

const CLICKUP_PATTERN = /\[CU:([^\]\s]+)\]/g
const GITHUB_PATTERN = /\[GH:(\d+)\]/g
const STAGE_KEYS: readonly string[] = [
  'reception',
  'a_faire',
  'en_cours',
  'bloque',
  'en_validation',
  'termine',
  'annule',
  'acheve',
]

export type ProjectionErrorKind = 'missing' | 'corrupt' | 'schema'

export class ProjectionError extends Error {
  readonly kind: ProjectionErrorKind
  readonly path: string

  constructor(kind: ProjectionErrorKind, path: string, message: string) {
    super(message)
    this.name = 'ProjectionError'
    this.kind = kind
    this.path = path
  }
}

export function stageKeyFromId(stageId: number): StageKey {
  return STAGE_KEY_BY_ID[stageId] ?? 'inconnu'
}

export function extractClickupIds(text: string): string[] {
  return Array.from(text.matchAll(CLICKUP_PATTERN), (match) => match[1])
}

export function extractGithubIssues(text: string): number[] {
  return Array.from(text.matchAll(GITHUB_PATTERN), (match) => Number.parseInt(match[1], 10))
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(toString).filter((entry) => entry.length > 0)
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }
  return null
}

function toPriority(value: unknown): number {
  const parsed = toInt(value)
  if (parsed === null) return 0
  if (parsed < 0) return 0
  if (parsed > 3) return 3
  return parsed
}

function toStageKey(value: unknown, stageId: number): StageKey {
  if (typeof value === 'string' && STAGE_KEYS.includes(value)) return value as StageKey
  return stageKeyFromId(stageId)
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  if (typeof value === 'number') return value !== 0
  return fallback
}

function firstOrNull(values: string[]): string | null {
  return values.length > 0 ? values[0] : null
}

export function normalizeTask(raw: unknown): OperationTask | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>

  const id = toInt(record.id)
  if (id === null) return null

  const stageId = toInt(record.stage_id) ?? 0
  const stageKey = toStageKey(record.stage_key, stageId)
  const name = toString(record.name) || `Tâche ${id}`
  const description = typeof record.description_excerpt === 'string'
    ? record.description_excerpt
    : typeof record.description === 'string'
      ? record.description
      : ''

  const clickupFromText = extractClickupIds(description)
  const githubFromText = extractGithubIssues(description)
  const clickupRef = toString(record.clickup_ref) || null
  const githubRef = toString(record.github_ref) || null

  return {
    id,
    ref: toString(record.ref) || `odoo:${id}`,
    name,
    stage_id: stageId,
    stage_key: stageKey,
    is_terminal: TERMINAL_STAGE_KEYS.includes(stageKey),
    deadline: isIsoDate(record.deadline) ? (record.deadline as string) : null,
    priority: toPriority(record.priority),
    assignees: toStringArray(record.assignees),
    tags: toStringArray(record.tags),
    parent_id: toInt(record.parent_id),
    clickup_ref: clickupRef,
    github_ref: githubRef,
    is_recurring: toBoolean(record.is_recurring, false),
    active: toBoolean(record.active, true),
    description_excerpt: description,
    clickup_id: clickupRef ?? firstOrNull(clickupFromText),
    github_issue: githubRef
      ? toInt(githubRef)
      : githubFromText.length > 0
        ? githubFromText[0]
        : null,
  }
}

export interface NormalizedTasks {
  tasks: OperationTask[]
  rejected: number
}

export function normalizeTasks(raw: unknown): NormalizedTasks {
  if (!Array.isArray(raw)) {
    throw new ProjectionError('schema', '', 'champ `tasks` absent ou non tableau')
  }
  const tasks: OperationTask[] = []
  let rejected = 0
  for (const entry of raw) {
    const task = normalizeTask(entry)
    if (task) tasks.push(task)
    else rejected += 1
  }
  return { tasks, rejected }
}

export function normalizeStageMap(raw: unknown): Record<number, StageKey> {
  if (typeof raw !== 'object' || raw === null) return { ...STAGE_KEY_BY_ID }
  const map: Record<number, StageKey> = { ...STAGE_KEY_BY_ID }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const stageId = toInt(key)
    if (stageId === null) continue
    if (typeof value === 'string' && STAGE_KEYS.includes(value)) map[stageId] = value as StageKey
  }
  return map
}
