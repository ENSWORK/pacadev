// Historique des projections Odoo : lecture des archives quotidiennes.
//
// L'archive a exactement le meme schema que la projection servie — une seule
// forme a lire, donc un seul normalizer. Ce qui change, c'est le temps : on lit
// une serie. Trois pieges concrets, tous rencontres dans ce chantier :
//
//  1. Une archive de schema inconnu ne doit pas casser le cockpit. Le jour ou la
//     v2 du schema sera emise, les archives v1 resteront sur disque pendant
//     90 jours : il faut savoir les lire, ou les ignorer en le disant.
//  2. Un fichier ecrit a moitie — coupure de courant pendant une purge — doit
//     etre rejete sans casser la lecture des autres.
//  3. L'historique ne vaut que si on sait jusqu'ou il remonte. Sans `coverage`,
//     une courbe qui commence au 20/09 alors que l'archive commence au 14/09
//     laisse croire a six jours perdus.
//
// Aucune donnee n'est inventee : un fichier illisible est compte, signale, et
// laisse un trou date plutot qu'un trou silencieux.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { normalizeTasks } from './normalize'
import { todayIso } from './time'
import { TERMINAL_STAGE_KEYS, type OperationTask } from './types'

export const DEFAULT_HISTORY_DIR = '.data/history'

/** Schemas d'archive que ce lecteur sait lire. Il est tolerant : il reconnait ce
 *  qu'il sait, et signale le reste plutot que de le deviner. */
export const HISTORY_SUPPORTED_SCHEMAS: readonly number[] = [1]

/** Un fichier modifie il y a moins de ca est considere comme en cours
 *  d'ecriture : on ne le lit pas, plutot que de le lire a moitie. */
export const HISTORY_WRITE_GRACE_MS = 5 * 60_000

export type HistorySkipReason =
  | 'illisible'
  | 'json_invalide'
  | 'schema_inconnu'
  | 'sans_taches'
  | 'en_cours_ecriture'

/** Le nom de fichier est un contrat : il date un point et fixe l'ordre de la
 *  série. Or `isIsoDate` laisse passer le 30 février, parce que JavaScript le
 *  fait glisser au 2 mars — `Date.parse` seul ne suffit donc pas. On exige un
 *  aller-retour exact. On ne corrige pas `isIsoDate` : il sert aussi à valider
 *  les échéances du cockpit, et changer ce comportement-là relève d'une autre
 *  décision. */
export function isArchiveDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  return date.toISOString().slice(0, 10) === value
}

export interface HistoryCounts {
  total: number
  done: number
  open: number
  late: number
  by_stage: Record<string, number>
}

export interface HistoryPoint extends HistoryCounts {
  /** Date de l'archive, prise dans le nom de fichier. Jamais `generated_at` :
   *  deux generations le meme jour font UNE archive, pas deux points. */
  date: string
  generated_at: string
  tasks: OperationTask[]
}

export interface HistorySkip {
  date: string
  reason: HistorySkipReason
  detail: string
}

export interface HistorySeries {
  points: HistoryPoint[]
  /** Fichiers trouves mais non lisibles, avec la raison. Un detail explicite
   *  vaut mieux qu'une courbe qui s'arrete sans explication. */
  skipped: HistorySkip[]
  first_date: string | null
  last_date: string | null
  /** Jours entre le premier point et aujourd'hui — la longueur reelle de la
   *  serie, pour savoir si l'on peut parler de tendance. */
  coverage: number
  /** Etendue couverte par les points eux-memes : du premier au dernier. Different
   *  de `coverage` des que la serie n'est pas arrivee jusqu'a aujourd'hui. */
  span: number
  /** Points effectivement lus. */
  days_covered: number
}

/** `late` se calcule par rapport a la date de l'archive, pas a aujourd'hui :
 *  une tache echue le 10/09 l'etait deja le 11. */
function deriveCounts(tasks: OperationTask[], archiveDate: string): HistoryCounts {
  const by_stage: Record<string, number> = {}
  let done = 0
  let late = 0

  for (const task of tasks) {
    by_stage[task.stage_key] = (by_stage[task.stage_key] ?? 0) + 1
    if (TERMINAL_STAGE_KEYS.includes(task.stage_key)) {
      done += 1
    } else if (task.deadline !== null && task.deadline < archiveDate) {
      late += 1
    }
  }

  return { total: tasks.length, done, open: tasks.length - done, late, by_stage }
}

export function readHistoryFile(
  path: string,
  date: string,
): { point: HistoryPoint | null; skip: HistorySkip | null } {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    return { point: null, skip: { date, reason: 'illisible', detail: (error as Error).message } }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { point: null, skip: { date, reason: 'json_invalide', detail: (error as Error).message } }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { point: null, skip: { date, reason: 'json_invalide', detail: 'racine invalide' } }
  }

  const header = parsed as Record<string, unknown>
  const version = header.schema_version
  if (typeof version === 'number' && !HISTORY_SUPPORTED_SCHEMAS.includes(version)) {
    return {
      point: null,
      skip: {
        date,
        reason: 'schema_inconnu',
        detail: `schema_version ${version}, ce lecteur lit ${HISTORY_SUPPORTED_SCHEMAS.join(', ')}`,
      },
    }
  }

  if (!Array.isArray(header.tasks)) {
    return { point: null, skip: { date, reason: 'sans_taches', detail: 'champ `tasks` absent' } }
  }

  // Ici on absorbe les taches illisibles au lieu de tout perdre : une archive
  // partiellement lisible vaut mieux qu'un point absent, et l'ecart est signe.
  const { tasks, rejected } = normalizeTasks(header.tasks)

  return {
    point: {
      date,
      ...deriveCounts(tasks, date),
      generated_at: typeof header.generated_at === 'string' ? header.generated_at : '',
      tasks,
    },
    skip: rejected > 0
      ? { date, reason: 'illisible', detail: `${rejected} tâche(s) illisible(s), archive partielle` }
      : null,
  }
}

export interface HistoryOptions {
  dir?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  now?: () => number
  graceMs?: number
}

export function resolveHistoryDir(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env.OPERATIONS_TASKS_HISTORY_DIR ?? '').trim()
  const target = configured.length > 0 ? configured : DEFAULT_HISTORY_DIR
  return isAbsolute(target) ? target : resolve(cwd, target)
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

export function readHistorySeries(options: HistoryOptions = {}): HistorySeries {
  const dir = options.dir ?? resolveHistoryDir(options.cwd, options.env)
  const now = options.now ?? Date.now
  const graceMs = options.graceMs ?? HISTORY_WRITE_GRACE_MS

  const vide: HistorySeries = {
    points: [],
    skipped: [],
    first_date: null,
    last_date: null,
    coverage: 0,
    span: 0,
    days_covered: 0,
  }

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return vide
    return { ...vide, skipped: [{ date: dir, reason: 'illisible', detail: (error as Error).message }] }
  }

  const dates = entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .filter(isArchiveDate)
    .sort()

  if (dates.length === 0) return vide

  const points: HistoryPoint[] = []
  const skipped: HistorySkip[] = []
  const maintenant = now()
  // Jour de reference = Casablanca, comme le cockpit. Lire l'UTC serait faux
  // une heure par jour : entre 00:00 et 01:00 locale, l'UTC est encore la
  // veille, et `coverage` sous-comterait la serie d'un jour.
  const aujourdhui = todayIso(new Date(maintenant))

  for (const date of dates) {
    const path = resolve(dir, `${date}.json`)

    let mtimeMs: number
    try {
      mtimeMs = statSync(path).mtimeMs
    } catch (error) {
      skipped.push({ date, reason: 'illisible', detail: (error as Error).message })
      continue
    }

    // Le job ecrit l'archive du jour avant la purge. Sans cette marge, un
    // fichier fraichement ecrit pourrait etre lu entre son remplacement et
    // l'ecriture complete sur certains systemes de fichiers.
    if (maintenant - mtimeMs < graceMs) {
      skipped.push({
        date,
        reason: 'en_cours_ecriture',
        detail: `écrit il y a ${Math.round((maintenant - mtimeMs) / 1000)} s, marge d'écriture non écoulée`,
      })
      continue
    }

    const { point, skip } = readHistoryFile(path, date)
    if (point) points.push(point)
    if (skip) skipped.push(skip)
  }

  if (points.length === 0) return { ...vide, skipped }

  return {
    points,
    skipped,
    first_date: points[0].date,
    last_date: points[points.length - 1].date,
    coverage: daysBetween(points[0].date, aujourdhui),
    span: daysBetween(points[0].date, points[points.length - 1].date),
    days_covered: points.length,
  }
}
