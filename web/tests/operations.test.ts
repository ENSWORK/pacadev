// Tests du cockpit operations - node:test + node:assert, aucune dependance.

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'

import { secondaryBadges, isBlocked, isLate } from '@/lib/operations/badges'
import {
  BUCKET_ORDER,
  assignBuckets,
  bucketOf,
  computeKpis,
  emptyBuckets,
} from '@/lib/operations/buckets'
import {
  DASHBOARD_DECISION_LIMIT,
  DASHBOARD_FACET_PAGE_SIZE,
  DASHBOARD_INITIATIVE_LIMIT,
  DASHBOARD_RISK_WINDOW_DAYS,
  FACET_LABEL,
  OPEN_STAGE_ORDER,
  UNASSIGNED_LABEL,
  buildAssigneeBars,
  buildDashboard,
  buildDecisions,
  buildInitiatives,
  buildStageBars,
  buildSummary,
  facetKey,
  isDecisionCandidate,
  selectFacet,
} from '@/lib/operations/dashboard'
import {
  GATE_COOKIE_NAME,
  GATE_TOKEN_MESSAGE,
  isValidSessionToken,
  passwordMatches,
  readGateCookie,
  safeEqual,
  sessionToken,
} from '@/lib/operations/gate'
import {
  ProjectionError,
  extractClickupIds,
  extractGithubIssues,
  normalizeStageMap,
  normalizeTask,
  normalizeTasks,
  stageKeyFromId,
} from '@/lib/operations/normalize'
import { buildOdooConfig } from '@/lib/operations/odoo-source'
import {
  createProjectionSource,
  readProjectionFile,
  resetProjectionCache,
} from '@/lib/operations/projection-source'
import { CLICKUP_PARITY_REASON, buildFreshness, loadOperations, staleAfterSeconds } from '@/lib/operations/service'
import { ageSeconds, diffIsoDays, formatIsoFr, isIsoDate, shiftIsoDate, todayIso } from '@/lib/operations/time'
import { STAGE_KEY_BY_ID, STAGE_LABEL, type DashboardFacet, type OperationTask, type TaskBucket } from '@/lib/operations/types'

const REPO_ROOT = process.env.OPERATIONS_REPO_ROOT ?? process.cwd()
const TODAY = '2026-09-25'
const PASSWORD = 'mot-de-passe-de-test'

const read = (relativePath) => readFileSync(join(REPO_ROOT, relativePath), 'utf8')

// l'env injecté dans les tests est partiel: ProcessEnv l'exige complet (NODE_ENV)
const asEnv = (values: Record<string, string>) => values as NodeJS.ProcessEnv

function task(raw: Record<string, unknown>): OperationTask {
  const normalized = normalizeTask(raw)
  assert.ok(normalized, `tâche non normalisable : ${JSON.stringify(raw)}`)
  return normalized
}

function writeJson(dir: string, name: string, value: unknown): string {
  const path = join(dir, name)
  writeFileSync(path, JSON.stringify(value), 'utf8')
  return path
}

// Compte les declarations d'un composant donne, pour prouver qu'il n'existe
// qu'une seule definition de la fenetre dans tout le cockpit.
function countDefinitions(source: string): number {
  return (source.match(/function DrilldownDialog/g) ?? []).length
}

function exportedMethods(source: string): string[] {
  return Array.from(source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)/g), (match) => match[1])
}

// ═════════════════════════════════════════════════════════════════════════
// Dates et fuseau
// ═════════════════════════════════════════════════════════════════════════

test('fuseau Africa/Casablanca et bornes de dates', () => {
  assert.equal(todayIso(new Date('2026-09-25T22:30:00Z')), '2026-09-25')
  assert.equal(todayIso(new Date('2026-09-25T23:30:00Z')), '2026-09-26')
  assert.equal(shiftIsoDate(TODAY, 14), '2026-10-09')
  assert.equal(shiftIsoDate('2026-10-09', 1), '2026-10-10')
  assert.equal(diffIsoDays(TODAY, '2026-10-09'), 14)
  assert.equal(diffIsoDays('2026-10-09', TODAY), -14)
  assert.equal(diffIsoDays(TODAY, TODAY), 0)
  assert.equal(isIsoDate('2026-09-25'), true)
  assert.equal(isIsoDate('25/09/2026'), false)
  assert.equal(isIsoDate(null), false)
})

// ═════════════════════════════════════════════════════════════════════════
// Normalisation
// ═════════════════════════════════════════════════════════════════════════

test('normalisation: étape dérivée du stage_id, priorité string, ref canonique', () => {
  const normalized = task({ id: 42, name: '  X  ', stage_id: 9, deadline: '2026-09-30', priority: '2' })
  assert.equal(normalized.name, 'X')
  assert.equal(normalized.priority, 2)
  assert.equal(normalized.stage_key, 'en_cours')
  assert.equal(normalized.stage_id, 9)
  assert.equal(normalized.ref, 'odoo:42')
  assert.equal(normalized.is_terminal, false)
  assert.equal(normalized.deadline, '2026-09-30')
  assert.equal(normalized.parent_id, null)
  assert.equal(normalized.active, true)
  assert.equal(task({ id: 43, stage_id: 9, priority: '9' }).priority, 3)
  assert.equal(task({ id: 44, stage_id: 9, priority: -4 }).priority, 0)
  assert.equal(task({ id: 45, stage_id: 9, deadline: '30/09/2026' }).deadline, null)
  assert.equal(task({ id: 46, stage_id: 999 }).stage_key, 'inconnu')
  assert.equal(normalizeTask({}), null)
  assert.equal(normalizeTask({ id: 'abc' }), null)
  assert.equal(normalizeTask(null), null)
  assert.deepEqual(normalizeStageMap({ '10': 'bloque' })[10], 'bloque')
  assert.deepEqual(normalizeStageMap(null), STAGE_KEY_BY_ID)
})

test('extraction des références [CU:] et [GH:]', () => {
  const description = '[CU:86cb247dd] Changer le token [GH:412] puis [CU:autre-id] [GH:7]'
  assert.deepEqual(extractClickupIds(description), ['86cb247dd', 'autre-id'])
  assert.deepEqual(extractGithubIssues(description), [412, 7])
  assert.deepEqual(extractClickupIds('aucune reference'), [])
  assert.deepEqual(extractGithubIssues('aucune reference'), [])

  const fromText = task({ id: 1, stage_id: 8, description_excerpt: '[CU:abc] et [GH:9]' })
  assert.equal(fromText.clickup_id, 'abc')
  assert.equal(fromText.github_issue, 9)

  const explicit = task({
    id: 2,
    stage_id: 8,
    clickup_ref: 'ref-explicite',
    github_ref: '55',
    description_excerpt: '[CU:abc] et [GH:9]',
  })
  assert.equal(explicit.clickup_id, 'ref-explicite')
  assert.equal(explicit.github_issue, 55)

  const none = task({ id: 3, stage_id: 8 })
  assert.equal(none.clickup_id, null)
  assert.equal(none.github_issue, null)
})

// ═════════════════════════════════════════════════════════════════════════
// Étapes réelles
// ═════════════════════════════════════════════════════════════════════════

test('Achevé et Terminé sont deux étapes distinctes, jamais fusionnées', () => {
  assert.equal(stageKeyFromId(20), 'acheve')
  assert.equal(stageKeyFromId(12), 'termine')
  assert.equal(stageKeyFromId(13), 'annule')
  assert.notEqual(STAGE_LABEL.acheve, STAGE_LABEL.termine)
  assert.equal(STAGE_LABEL.acheve, 'Achevé')
  assert.equal(STAGE_LABEL.termine, 'Terminé')

  const acheve = task({ id: 1, stage_id: 20, deadline: '2026-01-01' })
  const termine = task({ id: 2, stage_id: 12, deadline: '2026-01-02' })
  const annule = task({ id: 3, stage_id: 13 })
  assert.equal(acheve.is_terminal, true)
  assert.equal(termine.is_terminal, true)
  assert.equal(annule.is_terminal, true)

  const { buckets, unclassified } = assignBuckets([acheve, termine, annule], TODAY)
  assert.equal(unclassified.length, 0)
  assert.equal(buckets.done.length, 3)
  // même bucket, mais les trois étapes restent distinctes ligne par ligne
  assert.deepEqual(
    new Set(buckets.done.map((entry) => entry.stage_key)),
    new Set(['acheve', 'termine', 'annule']),
  )
})

test('toutes les étapes Odoo du projet 1 sont reconnues', () => {
  assert.deepEqual(STAGE_KEY_BY_ID, {
    1: 'reception',
    8: 'a_faire',
    9: 'en_cours',
    10: 'bloque',
    11: 'en_validation',
    12: 'termine',
    13: 'annule',
    20: 'acheve',
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Buckets exclusifs
// ═════════════════════════════════════════════════════════════════════════

test('exclusivité des buckets: une tâche = une seule ligne, zéro double comptage', () => {
  const tasks = [
    task({ id: 1, stage_id: 20 }),
    task({ id: 2, stage_id: 12, deadline: '2026-09-01' }),
    task({ id: 3, stage_id: 8, deadline: '2026-09-20' }),
    task({ id: 4, stage_id: 8, deadline: TODAY }),
    task({ id: 5, stage_id: 10, deadline: '2026-09-22' }),
    task({ id: 6, stage_id: 11, deadline: '2026-09-23' }),
    task({ id: 7, stage_id: 8 }),
    task({ id: 8, stage_id: 1 }),
    task({ id: 9, stage_id: 9, deadline: '2026-10-05' }),
    task({ id: 10, stage_id: 9, deadline: '2026-10-10' }),
    task({ id: 11, stage_id: 9, deadline: '2026-12-31' }),
  ]
  const { buckets, unclassified } = assignBuckets(tasks, TODAY)

  const owners = new Map<number, string[]>()
  for (const key of BUCKET_ORDER) {
    for (const entry of buckets[key]) {
      owners.set(entry.id, [...(owners.get(entry.id) ?? []), key])
    }
  }
  assert.equal(owners.size, tasks.length)
  for (const [id, list] of owners) {
    assert.equal(list.length, 1, `tâche ${id} présente dans ${list.length} buckets : ${list.join(', ')}`)
  }
  assert.equal(unclassified.length, 0)
  assert.equal(
    BUCKET_ORDER.reduce((sum, key) => sum + buckets[key].length, 0),
    tasks.length,
  )
})

test('ordre d’évaluation des buckets', () => {
  // terminéprime sur « en retard »
  assert.equal(bucketOf(task({ id: 1, stage_id: 20, deadline: '2020-01-01' }), TODAY), 'done')
  // terminé prime sur « aujourd’hui »
  assert.equal(bucketOf(task({ id: 2, stage_id: 12, deadline: TODAY }), TODAY), 'done')
  // retard prime sur intervention
  assert.equal(bucketOf(task({ id: 3, stage_id: 10, deadline: '2026-09-24' }), TODAY), 'late')
  // aujourd’hui prime sur intervention
  assert.equal(bucketOf(task({ id: 4, stage_id: 11, deadline: TODAY }), TODAY), 'today')
  // intervention ensuite
  assert.equal(bucketOf(task({ id: 5, stage_id: 10 }), TODAY), 'intervention')
  assert.equal(bucketOf(task({ id: 6, stage_id: 11, deadline: '2026-10-01' }), TODAY), 'intervention')
  // puis à planifier
  assert.equal(bucketOf(task({ id: 7, stage_id: 8 }), TODAY), 'a_planifier')
  assert.equal(bucketOf(task({ id: 8, stage_id: 1 }), TODAY), 'a_planifier')
  // puis les fenêtres de date
  assert.equal(bucketOf(task({ id: 9, stage_id: 9, deadline: '2026-09-26' }), TODAY), 'j14')
  assert.equal(bucketOf(task({ id: 10, stage_id: 9, deadline: '2026-10-09' }), TODAY), 'j14')
  assert.equal(bucketOf(task({ id: 11, stage_id: 9, deadline: '2026-10-10' }), TODAY), 'plus_tard')
  // en_cours sans échéance: aucune règle ne s’applique, jamais masqué
  assert.equal(bucketOf(task({ id: 12, stage_id: 9 }), TODAY), null)
})

test('tâche bloquée et en retard: une seule ligne, deux badges', () => {
  const blockedLate = task({
    id: 7,
    name: 'Rotation du token API',
    stage_id: 10,
    deadline: '2026-09-20',
    description_excerpt: '[CU:abc123] Bloqué sur ClickUp',
  })
  const { buckets, unclassified } = assignBuckets([blockedLate], TODAY)

  assert.equal(unclassified.length, 0)
  assert.equal(buckets.late.length, 1)
  assert.equal(buckets.intervention.length, 0)
  assert.equal(buckets.done.length, 0)
  assert.equal(buckets.late[0].id, blockedLate.id)

  assert.equal(isBlocked(blockedLate), true)
  assert.equal(isLate(blockedLate, TODAY), true)
  const badges = secondaryBadges(blockedLate, TODAY)
  assert.ok(badges.includes('bloquee'))
  assert.ok(badges.includes('en_retard'))
  assert.ok(badges.includes('clickup'))
  // les badges ne changent pas le nombre de buckets occupés
  assert.equal(BUCKET_ORDER.filter((key) => buckets[key].length > 0).length, 1)
})

test('tâche sans échéance', () => {
  const aFaire = task({ id: 1, stage_id: 8 })
  const reception = task({ id: 2, stage_id: 1 })
  const { buckets } = assignBuckets([aFaire, reception], TODAY)
  assert.equal(buckets.a_planifier.length, 2)
  assert.equal(buckets.late.length, 0)
  assert.equal(buckets.today.length, 0)
  assert.ok(secondaryBadges(aFaire, TODAY).includes('sans_echeance'))
})

test('tâche récurrente: badge secondaire, bucket inchangé', () => {
  const once = task({ id: 1, stage_id: 8, deadline: '2026-09-27' })
  const recurring = task({ id: 2, stage_id: 8, deadline: '2026-09-27', is_recurring: true })
  const { buckets } = assignBuckets([once, recurring], TODAY)
  assert.equal(buckets.j14.length, 2)
  assert.equal(secondaryBadges(once, TODAY).includes('recurrent'), false)
  assert.equal(secondaryBadges(recurring, TODAY).includes('recurrent'), true)
})

test('sous-tâche: parent conservé, badge secondaire', () => {
  const child = task({ id: 2, stage_id: 9, parent_id: 169, deadline: '2026-09-27' })
  const { buckets } = assignBuckets([child], TODAY)
  assert.equal(child.parent_id, 169)
  assert.equal(buckets.j14.length, 1)
  const badges = secondaryBadges(child, TODAY)
  assert.ok(badges.includes('sous_tache'))
  assert.ok(badges.includes('echeance_proche'))
})

test('KPI disjoints et cohérents avec les buckets', () => {
  const tasks = [
    task({ id: 1, stage_id: 20 }),
    task({ id: 2, stage_id: 12 }),
    task({ id: 3, stage_id: 8, deadline: '2026-09-01' }),
    task({ id: 4, stage_id: 8, deadline: TODAY }),
    task({ id: 5, stage_id: 10 }),
    task({ id: 6, stage_id: 8 }),
    task({ id: 7, stage_id: 9, deadline: '2026-10-01' }),
    task({ id: 8, stage_id: 9, deadline: '2027-01-01' }),
    task({ id: 9, stage_id: 9 }),
  ]
  const { buckets, unclassified } = assignBuckets(tasks, TODAY)
  const kpis = computeKpis(buckets, tasks.length)

  assert.equal(kpis.total, tasks.length)
  assert.equal(kpis.done, 2)
  assert.equal(kpis.late, 1)
  assert.equal(kpis.today, 1)
  assert.equal(kpis.intervention, 1)
  assert.equal(kpis.a_planifier, 1)
  assert.equal(kpis.j14, 1)
  assert.equal(unclassified.length, 1)
  // les 7 KPI (hors « plus tard », qui est une section sans KPI) + la section
  // « plus tard » + les non classées = le total, sans double comptage
  assert.equal(
    kpis.done +
      kpis.late +
      kpis.today +
      kpis.intervention +
      kpis.a_planifier +
      kpis.j14 +
      buckets.plus_tard.length +
      unclassified.length,
    tasks.length,
  )
  assert.equal(computeKpis(emptyBuckets(), 0).total, 0)
})

// ═════════════════════════════════════════════════════════════════════════
// Fraîcheur
// ═════════════════════════════════════════════════════════════════════════

test('calcul de l’obsolescence', () => {
  const now = new Date('2026-09-25T12:00:00Z')
  const snapshot = (generated_at: string) => ({ tasks: [], generated_at, stage_map: {}, detail: null })

  assert.equal(ageSeconds('2026-09-25T11:58:00Z', now), 120)
  assert.equal(ageSeconds('2026-09-25T12:00:00Z', now), 0)
  assert.equal(ageSeconds('2026-09-25T13:00:00Z', now), 0)
  assert.equal(Number.isNaN(ageSeconds('pas-une-date', now)), true)

  const fresh = buildFreshness(snapshot('2026-09-25T11:30:00Z'), 'projection', now, 3600)
  assert.equal(fresh.stale, false)
  assert.equal(fresh.age_seconds, 1800)
  assert.equal(fresh.source, 'projection')
  assert.equal(fresh.stale_after_seconds, 3600)

  const stale = buildFreshness(snapshot('2026-09-25T09:00:00Z'), 'projection', now, 3600)
  assert.equal(stale.stale, true)
  assert.equal(stale.age_seconds, 10_800)

  // fraîcheur inconnue => donnée considérée obsolète, jamais présumée récente
  const unknown = buildFreshness(snapshot('corrompu'), 'projection', now, 3600)
  assert.equal(unknown.stale, true)

  assert.equal(staleAfterSeconds(undefined, asEnv({})), 3600)
  assert.equal(staleAfterSeconds('30', asEnv({})), 1800)
  assert.equal(staleAfterSeconds('bidon', asEnv({})), 3600)
  assert.equal(staleAfterSeconds('-5', asEnv({})), 3600)
  assert.equal(staleAfterSeconds(undefined, asEnv({ OPERATIONS_TASKS_STALE_MINUTES: '5' })), 300)
  // l'argument explicite prime sur l'environnement
  assert.equal(staleAfterSeconds('30', asEnv({ OPERATIONS_TASKS_STALE_MINUTES: '5' })), 1800)
})

// ═════════════════════════════════════════════════════════════════════════
// Sources
// ═════════════════════════════════════════════════════════════════════════

test('projection corrompue, absente ou de schéma invalide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops-corrupt-'))

  const broken = join(dir, 'broken.json')
  writeFileSync(broken, '{ "schema_version": 1, "tasks": [ ', 'utf8')
  assert.throws(
    () => readProjectionFile(broken),
    (error) => error instanceof ProjectionError && error.kind === 'corrupt',
  )

  const notArray = writeJson(dir, 'not-array.json', { schema_version: 1, tasks: 'nope' })
  assert.throws(
    () => readProjectionFile(notArray),
    (error) => error instanceof ProjectionError && error.kind === 'schema',
  )

  const badVersion = writeJson(dir, 'bad-version.json', { schema_version: 99, tasks: [] })
  assert.throws(
    () => readProjectionFile(badVersion),
    (error) => error instanceof ProjectionError && error.kind === 'schema',
  )

  const rootArray = writeJson(dir, 'root-array.json', [])
  assert.throws(
    () => readProjectionFile(rootArray),
    (error) => error instanceof ProjectionError && error.kind === 'corrupt',
  )

  assert.throws(
    () => readProjectionFile(join(dir, 'absent.json')),
    (error) => error instanceof ProjectionError && error.kind === 'missing',
  )
})

test('projection valide: lecture et cache court de 60 s', async () => {
  resetProjectionCache()
  const dir = mkdtempSync(join(tmpdir(), 'ops-cache-'))
  const path = writeJson(dir, 'projection.json', {
    schema_version: 1,
    generated_at: '2026-09-25T11:00:00Z',
    stage_map: { '10': 'bloque' },
    counts: { total: 1 },
    tasks: [{ id: 1, name: 'Une tâche', stage_id: 10, priority: '1', deadline: '2026-09-27' }],
  })

  const clock = { at: 1_000_000 }
  const source = createProjectionSource({ path, now: () => clock.at, cacheMs: 60_000 })

  const first = await source.load()
  assert.equal(first.tasks.length, 1)
  assert.equal(first.tasks[0].stage_key, 'bloque')
  assert.equal(first.generated_at, '2026-09-25T11:00:00Z')
  assert.equal(first.stage_map[10], 'bloque')
  assert.equal(source.name, 'projection')

  // fichier écrasé mais cache encore valide => servi depuis le cache
  writeFileSync(path, JSON.stringify({ schema_version: 1, generated_at: '2026-09-25T11:00:00Z', tasks: [] }), 'utf8')
  assert.equal((await source.load()).tasks.length, 1)

  // au-delà de 60 s => relecture
  clock.at += 60_001
  assert.equal((await source.load()).tasks.length, 0)
  resetProjectionCache()
})

test('la source Odoo JSON-2 n’est active qu’avec ODOO_TASKS_API_KEY', () => {
  assert.equal(buildOdooConfig(asEnv({})), null)
  assert.equal(buildOdooConfig(asEnv({ ODOO_TASKS_API_KEY: '   ' })), null)
  assert.equal(buildOdooConfig(asEnv({ ODOO_TASKS_API_KEY: 'clé' })), null)
  const config = buildOdooConfig(
    asEnv({
      ODOO_TASKS_API_KEY: 'clé',
      ODOO_TASKS_URL: 'https://odoo.exemple/',
      ODOO_TASKS_DB: 'pacadai',
    })
  )
  assert.ok(config)
  assert.equal(config.url, 'https://odoo.exemple')
  assert.equal(config.database, 'pacadai')
  assert.equal(config.pageSize, 200)
  assert.equal(config.timeoutMs, 15_000)
})

test('loadOperations: payload en lecture seule et parité ClickUp indisponible', async () => {
  resetProjectionCache()
  const { payload, sourceName } = await loadOperations({ env: asEnv({}), cwd: REPO_ROOT })
  assert.equal(sourceName, 'projection')
  assert.equal(payload.read_only, true)
  assert.equal(payload.freshness.source, 'projection')
  assert.equal(payload.timezone, 'Africa/Casablanca')
  assert.equal(payload.today, todayIso(new Date(), 'Africa/Casablanca'))
  assert.equal(payload.clickup_parity.available, false)
  assert.equal(payload.clickup_parity.reason, CLICKUP_PARITY_REASON)
  assert.match(payload.clickup_parity.reason, /indisponible/i)
  assert.ok(payload.tasks.length > 0)
  assert.equal(payload.kpis.total, payload.tasks.length)
  // le tableau de bord est toujours présent, dérivé des mêmes tâches
  assert.ok(payload.dashboard)
  assert.equal(payload.dashboard.summary.total, payload.tasks.length)
  assert.equal(payload.dashboard.summary.open, payload.kpis.total - payload.kpis.done)
  assert.equal(payload.dashboard.by_assignee_total.length > 0, true)
  assert.equal(payload.dashboard.summary.lines.length, 5)
})

// ═════════════════════════════════════════════════════════════════════════
// Garde par mot de passe
// ═════════════════════════════════════════════════════════════════════════

test('mot de passe correct / incorrect', () => {
  assert.equal(passwordMatches(PASSWORD, PASSWORD), true)
  assert.equal(passwordMatches(`${PASSWORD}x`, PASSWORD), false)
  assert.equal(passwordMatches('mauvais', PASSWORD), false)
  assert.equal(passwordMatches('', PASSWORD), false)
  assert.equal(passwordMatches(undefined, PASSWORD), false)
  assert.equal(passwordMatches(42, PASSWORD), false)
  // non configuré => jamais ouvert par défaut
  assert.equal(passwordMatches(PASSWORD, undefined), false)
  assert.equal(passwordMatches(PASSWORD, ''), false)
  assert.equal(safeEqual('a', 'a'), true)
  assert.equal(safeEqual('a', 'b'), false)
  assert.equal(safeEqual('', ''), true)
})

test('401 sans cookie: aucun jeton fabriqué n’est accepté', () => {
  assert.equal(isValidSessionToken(undefined, PASSWORD), false)
  assert.equal(isValidSessionToken(null, PASSWORD), false)
  assert.equal(isValidSessionToken('', PASSWORD), false)
  assert.equal(isValidSessionToken('jeton-fabriqué', PASSWORD), false)
  assert.equal(isValidSessionToken(sessionToken('autre-mot-de-passe'), PASSWORD), false)
  assert.equal(isValidSessionToken(sessionToken(PASSWORD), PASSWORD), true)
  // non configuré => aucune session valide possible
  assert.equal(isValidSessionToken(sessionToken(PASSWORD), undefined), false)

  // le jeton est l'empreinte HMAC de la constante, calculée avec le mot de passe
  const expected = createHmac('sha256', PASSWORD).update(GATE_TOKEN_MESSAGE, 'utf8').digest('hex')
  assert.equal(sessionToken(PASSWORD), expected)
  assert.equal(GATE_TOKEN_MESSAGE, 'pacadev-operations-gate')

  assert.equal(readGateCookie(null), null)
  assert.equal(readGateCookie('autre=1'), null)
  assert.equal(readGateCookie(`${GATE_COOKIE_NAME}=`), null)
  assert.equal(readGateCookie(`autre=1; ${GATE_COOKIE_NAME}=${expected}; x=2`), expected)
})

// ═════════════════════════════════════════════════════════════════════════
// Garanties d'API : aucune écriture
// ═════════════════════════════════════════════════════════════════════════

test('aucune route d’écriture dans tout le scope operations', () => {
  const dir = join(REPO_ROOT, 'src/app/api/operations')
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .sort()
  assert.deepEqual(files, ['session/route.ts', 'tasks/route.ts'])

  const methods = new Map(files.map((file) => [file, exportedMethods(readFileSync(join(dir, file), 'utf8'))]))
  assert.deepEqual(methods.get('tasks/route.ts'), ['GET'])
  assert.deepEqual(methods.get('session/route.ts'), ['POST', 'DELETE'])
})

test('la route des tâches ne contient aucune écriture ni méthode mutante', () => {
  const source = read('src/app/api/operations/tasks/route.ts')
  assert.match(source, /export\s+async\s+function\s+GET\b/)
  for (const forbidden of ['writeFileSync', 'appendFileSync', 'createWriteStream', 'unlinkSync', 'rmSync']) {
    assert.equal(source.includes(forbidden), false, `${forbidden} dans la route des tâches`)
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(exportedMethods(source).includes(method), false, `${method} exporté par la route des tâches`)
  }
  // 503 quand le mot de passe n'est pas configuré, 401 sans session valide
  assert.match(source, /status:\s*503/)
  assert.match(source, /status:\s*401/)
})

test('la projection n’est jamais importable depuis le bundle client', () => {
  const shared = ['types.ts', 'time.ts', 'normalize.ts', 'buckets.ts', 'badges.ts', 'dashboard.ts']
  for (const file of shared) {
    const source = read(`src/lib/operations/${file}`)
    assert.equal(/from\s+['"]node:/.test(source), false, `${file} importe un module node:`)
    for (const server of ['projection-source', 'odoo-source', 'operations/gate', 'operations/service']) {
      assert.equal(source.includes(server), false, `${file} référence ${server}`)
    }
  }

  const walk = (relativeDir) =>
    readdirSync(join(REPO_ROOT, relativeDir), { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.ts') || entry.endsWith('.tsx'))
      .map((entry) => `${relativeDir}/${entry}`)

  const clientFiles = walk('src').filter((file) => read(file).includes("'use client'"))
  assert.ok(clientFiles.length > 0)
  for (const file of clientFiles) {
    const source = read(file)
    for (const forbidden of [
      'operations-tasks.json',
      'projection-source',
      'odoo-source',
      'operations/gate',
      'operations/service',
    ]) {
      assert.equal(source.includes(forbidden), false, `${file} référence ${forbidden}`)
    }
  }

  // la vue cockpit ne lit jamais l'environnement: aucun secret ne peut
  // se retrouver dans le bundle client
  const cockpit = read('src/components/modules/operations-tasks.tsx')
  assert.equal(cockpit.includes('process.env'), false, 'la vue cockpit lit process.env')
  assert.equal(cockpit.includes('OPERATIONS_TASKS_PASSWORD='), false, 'mot de passe en clair dans la vue')
  assert.equal(cockpit.includes('ODOO_TASKS_API_KEY='), false, 'clé API en clair dans la vue')
})

test('aucune dépendance externe ajoutée dans src/lib/operations', () => {
  const dir = join(REPO_ROOT, 'src/lib/operations')
  const files = readdirSync(dir, { encoding: 'utf8' }).filter((entry) => entry.endsWith('.ts')).sort()
  assert.deepEqual(files, [
    'badges.ts',
    'buckets.ts',
    'dashboard.ts',
    'gate.ts',
    'normalize.ts',
    'odoo-source.ts',
    'projection-source.ts',
    'service.ts',
    'time.ts',
    'types.ts',
  ])
  for (const file of files) {
    const source = readFileSync(join(dir, file), 'utf8')
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      assert.ok(
        specifier.startsWith('.') || specifier.startsWith('node:'),
        `${file} importe la dépendance externe ${specifier}`,
      )
    }
  }
})

// ═════════════════════════════════════════════════════════════════════════
// Intégration du shell piloté par le store
// ═════════════════════════════════════════════════════════════════════════

test('la clé `operations` est branchée dans le store, la sidebar, le header et le rendu', () => {
  assert.match(read('src/lib/store.ts'), /AppView\s*=.*'operations'/)
  assert.match(read('src/app/page.tsx'), /operations:\s*OperationsTasksModule/)
  assert.match(read('src/app/page.tsx'), /import\s+\{\s*OperationsTasksModule\s*\}/)
  assert.match(read('src/components/layout/app-sidebar.tsx'), /key:\s*'operations',\s*label:\s*'Opérations'/)
  assert.match(read('src/components/layout/app-header.tsx'), /operations:\s*'Opérations'/)
  // les entrées de menu existantes restent inchangées
  const sidebar = read('src/components/layout/app-sidebar.tsx')
  for (const existing of ['Tableau de bord', 'Clients', 'Workspace', 'Pipeline CI/CD', 'IA & Risque', 'Backup', 'Observabilité', 'Audit']) {
    assert.match(sidebar, new RegExp(`label:\\s*'${existing.replace(/[&/]/g, '\\$&')}'`))
  }
})

// ═════════════════════════════════════════════════════════════════════════
// Projection réelle
// ═════════════════════════════════════════════════════════════════════════

test('projection réelle: invariants de fraîcheur, de clé canonique et de classement', () => {
  const path = join(REPO_ROOT, '.data/operations-tasks.json')
  if (!existsSync(path)) return
  resetProjectionCache()

  const snapshot = readProjectionFile(path)
  const today = todayIso(new Date(), 'Africa/Casablanca')
  const { buckets, unclassified } = assignBuckets(snapshot.tasks, today)

  assert.ok(snapshot.tasks.length > 0)
  assert.equal(unclassified.length, 0, `${unclassified.length} tâche(s) hors modèle de bucket`)
  assert.equal(
    BUCKET_ORDER.reduce((sum, key) => sum + buckets[key].length, 0),
    snapshot.tasks.length,
  )

  const ids = new Set<number>()
  for (const entry of snapshot.tasks) {
    assert.equal(ids.has(entry.id), false, `id dupliqué ${entry.id}`)
    ids.add(entry.id)
    assert.equal(entry.ref, `odoo:${entry.id}`)
    assert.notEqual(entry.stage_key, 'inconnu', `étape inconnue pour ${entry.ref}`)
    assert.ok(entry.priority >= 0 && entry.priority <= 3)
    assert.equal(entry.deadline === null || isIsoDate(entry.deadline), true)
  }

  // les tâches bloquées et en retard existent bien et restent en un seul bucket
  for (const entry of snapshot.tasks) {
    if (isBlocked(entry) && isLate(entry, today)) {
      const owned = BUCKET_ORDER.filter((key) => buckets[key].some((row) => row.id === entry.id))
      assert.deepEqual(owned, ['late'])
        const badges = secondaryBadges(entry, today)
        assert.ok(badges.includes('bloquee'))
        assert.ok(badges.includes('en_retard'))
      }
  }

  // le tableau de bord est dérivé des mêmes tâches, sans rien masquer ni dupliquer
  const dashboard = buildDashboard(snapshot.tasks, today)
  assert.equal(dashboard.summary.total, snapshot.tasks.length)
  assert.equal(dashboard.summary.open + dashboard.summary.done, snapshot.tasks.length)
  // la charge par étape ne porte que les tâches ouvertes (Terminé/Achevé exclus)
  assert.equal(
    dashboard.by_stage.reduce((sum, bar) => sum + bar.count, 0),
    dashboard.summary.open,
  )
  assert.equal(
    dashboard.by_assignee_total.reduce((sum, bar) => sum + bar.count, 0),
    snapshot.tasks.length,
  )
  assert.equal(
    dashboard.by_assignee_open.reduce((sum, bar) => sum + bar.count, 0),
    dashboard.summary.open,
  )
  // les sous-tâches affichées ne sont qu'un extrait : l'invariant se vérifie sur
  // toutes les initiatives ouvertes, pas seulement celles du bloc
  const openParentIds = new Set(
    snapshot.tasks.filter((entry) => !entry.is_terminal).map((entry) => entry.id),
  )
  const subtasksOfOpenParents = snapshot.tasks.filter(
    (entry) => entry.parent_id !== null && openParentIds.has(entry.parent_id),
  ).length
  assert.equal(
    buildInitiatives(snapshot.tasks, Number.MAX_SAFE_INTEGER).reduce(
      (sum, item) => sum + item.children,
      0,
    ),
    subtasksOfOpenParents,
  )
  assert.ok(dashboard.decisions.length <= DASHBOARD_DECISION_LIMIT)
  assert.ok(dashboard.initiatives.length <= DASHBOARD_INITIATIVE_LIMIT)
  assert.equal(dashboard.summary.lines.length, 5)
})

// ═════════════════════════════════════════════════════════════════════════
// Tableau de bord de pilotage
// ═════════════════════════════════════════════════════════════════════════

const DASH_TASKS: OperationTask[] = [
  task({ id: 1, stage_id: 9, name: 'Décider du logiciel de comptabilité', deadline: '2026-09-30', priority: 3, assignees: ['Alice'] }),
  task({ id: 2, stage_id: 8, name: 'Valider la méthode EEM v2', deadline: '2026-09-20', priority: 1, assignees: ['Bob'] }),
  task({ id: 3, stage_id: 12, name: 'Décider sur le recrutement', priority: 0, assignees: ['Alice'] }),
  task({ id: 4, stage_id: 9, name: 'Parent Paie', deadline: '2026-09-30', assignees: ['Alice'] }),
  task({ id: 5, stage_id: 8, name: 'Saisie de la paie', parent_id: 4, deadline: '2026-09-25' }),
  task({ id: 6, stage_id: 12, name: 'Contrôle de la paie', parent_id: 4 }),
  task({ id: 7, stage_id: 10, name: 'Chantier bloqué', deadline: '2026-09-10', priority: 3 }),
  task({ id: 8, stage_id: 9, name: 'Dossier sans échéance', description_excerpt: 'il faut choisir la cible' }),
]

test('affichage des dates ISO en format français', () => {
  assert.equal(formatIsoFr('2026-09-25'), '25/09/2026')
  assert.equal(formatIsoFr('2026-01-05'), '05/01/2026')
  assert.equal(formatIsoFr('25/09/2026'), '25/09/2026')
})

test('graphique par étape: étapes ouvertes seulement, Terminé et Achevé exclus', () => {
  const bars = buildStageBars(DASH_TASKS)
  const openTotal = DASH_TASKS.filter((entry) => !entry.is_terminal).length
  assert.equal(openTotal, 6)
  // une étape terminale n'est plus une charge: elle ne porte aucune barre
  assert.equal(
    bars.reduce((sum, bar) => sum + bar.count, 0),
    openTotal,
    'les barres ne comptent que les tâches ouvertes',
  )
  const keys = bars.map((bar) => bar.key)
  assert.deepEqual(keys, ['a_faire', 'en_cours', 'bloque'])
  for (const closed of ['termine', 'acheve', 'annule']) {
    assert.equal(keys.includes(closed), false, `${closed} ne doit pas apparaître dans la charge`)
  }
  // ordre du flux réel respecté
  assert.ok(keys.indexOf('a_faire') < keys.indexOf('en_cours'))
  assert.ok(keys.indexOf('en_cours') < keys.indexOf('bloque'))
  // parts rapportées au total ouvert, et non au périmètre complet
  for (const bar of bars) {
    assert.equal(bar.share, Math.round((bar.count / openTotal) * 100) / 100)
  }
  assert.equal(OPEN_STAGE_ORDER.includes('termine'), false)
  assert.equal(OPEN_STAGE_ORDER.includes('acheve'), false)
  assert.equal(OPEN_STAGE_ORDER.includes('annule'), false)
  // l'exclusion ne perd rien: toute tâche terminée est bien is_terminal
  for (const entry of DASH_TASKS) {
    if (entry.stage_key === 'termine' || entry.stage_key === 'acheve') {
      assert.equal(entry.is_terminal, true)
    }
  }
})

test('graphiques par responsable: premier responsable stable et non assignés regroupés', () => {
  const all = buildAssigneeBars(DASH_TASKS, 'all')
  assert.deepEqual(all.map((bar) => bar.key), [UNASSIGNED_LABEL, 'Alice', 'Bob'])
  assert.equal(all[0].count, 4)
  assert.equal(all.reduce((sum, bar) => sum + bar.count, 0), DASH_TASKS.length)

  const open = buildAssigneeBars(DASH_TASKS, 'open')
  assert.deepEqual(open.map((bar) => bar.key), [UNASSIGNED_LABEL, 'Alice', 'Bob'])
  assert.equal(open.reduce((sum, bar) => sum + bar.count, 0), 6)
  assert.equal(open.every((bar) => bar.closed === 0), true)

  // le premier responsable est l'alphabétiquement premier, pas celui du premier retour Odoo
  const multi = task({ id: 20, stage_id: 9, name: 'Deux responsables', assignees: ['Zoe', 'Alice'] })
  assert.equal(buildAssigneeBars([multi], 'all')[0].key, 'Alice')
  // sans responsable : jamais de ligne vide
  const orphan = task({ id: 21, stage_id: 9, name: 'Tache isolee' })
  assert.equal(buildAssigneeBars([orphan], 'all')[0].key, UNASSIGNED_LABEL)
})

test('décisions clés: marqueur dans le nom ou la description, jamais en sous-tâche', () => {
  assert.equal(isDecisionCandidate(DASH_TASKS[0]), true, 'décision détectée par le nom')
  assert.equal(isDecisionCandidate(DASH_TASKS[7]), true, 'décision détectée par la description')
  assert.equal(isDecisionCandidate(DASH_TASKS[3]), false, 'parent sans marqueur')
  assert.equal(isDecisionCandidate(DASH_TASKS[4]), false, 'sous-tâche sans marqueur')
  const subtask = task({ id: 30, stage_id: 8, name: 'Valider un point', parent_id: 4 })
  assert.equal(isDecisionCandidate(subtask), false, 'une sous-tâche n’est jamais une décision')
  assert.equal(isDecisionCandidate(task({ id: 31, stage_id: 8, name: 'Classer le courrier' })), false)
})

test('décisions clés: non terminées d’abord, puis priorité, échéance la plus proche', () => {
  const decisions = buildDecisions(DASH_TASKS)
  assert.deepEqual(decisions.map((entry) => entry.id), [1, 2, 8, 3])
  assert.equal(decisions[0].is_open, true)
  assert.equal(decisions[decisions.length - 1].is_open, false)
  assert.equal(buildDecisions(DASH_TASKS, 2).length, 2)
  assert.equal(DASHBOARD_DECISION_LIMIT, 5)
})

test('efforts clés: uniquement les chantiers parents encore ouverts', () => {
  const initiatives = buildInitiatives(DASH_TASKS)
  assert.equal(initiatives.length, 1)
  assert.equal(initiatives[0].id, 4)
  assert.equal(initiatives[0].children, 2)
  assert.equal(initiatives[0].children_done, 1)
  assert.equal(initiatives[0].children_open, 1)
  assert.equal(initiatives[0].completion, 0.5)

  const closed = [
    task({ id: 40, stage_id: 12, name: 'Paie terminee' }),
    task({ id: 41, stage_id: 12, name: 'Ligne de paie', parent_id: 40 }),
  ]
  assert.deepEqual(buildInitiatives(closed), [], 'un chantier clôturé n’est plus à piloter')
  // une tâche isolée n'est pas une initiative
  assert.deepEqual(buildInitiatives([task({ id: 42, stage_id: 9, name: 'Tache isolee' })]), [])
  assert.equal(DASHBOARD_INITIATIVE_LIMIT, 6)

  // tri par sous-tâches ouvertes décroissantes
  const many = [
    task({ id: 50, stage_id: 9, name: 'Petit' }),
    task({ id: 51, stage_id: 8, name: 'a', parent_id: 50 }),
    task({ id: 52, stage_id: 9, name: 'Grand' }),
    task({ id: 53, stage_id: 8, name: 'b', parent_id: 52 }),
    task({ id: 54, stage_id: 8, name: 'c', parent_id: 52 }),
  ]
  assert.deepEqual(buildInitiatives(many).map((entry) => entry.id), [52, 50])
})

test('résumé exécutif: chiffres dérivés des tâches, 5 lignes, rien d’inventé', () => {
  const summary = buildSummary(DASH_TASKS, TODAY)
  assert.equal(summary.total, 8)
  assert.equal(summary.open, 6)
  assert.equal(summary.done, 2)
  assert.equal(summary.late, 2, 'tâches 2 et 7 ont une échéance dépassée')
  assert.equal(summary.due_today, 1, 'tâche 5')
  assert.equal(summary.at_risk, 2, 'tâches 1 et 7 : priorité 3 à J+7 ou au-delà')
  assert.equal(summary.blocked, 1, 'tâche 7')
  assert.equal(summary.in_validation, 0)
  assert.equal(summary.subtasks, 2)
  assert.equal(summary.parents, 1)
  assert.equal(summary.unassigned, 4)
  assert.equal(summary.decisions_total, 4)
  assert.equal(summary.decisions_open, 3)
  assert.equal(summary.completion, 0.25)
  assert.equal(summary.top_assignee, 'Alice', 'les non assignés ne sont pas un responsable')
  assert.equal(summary.top_assignee_count, 3)

  assert.equal(summary.lines.length, 5)
  for (const line of summary.lines) {
    assert.ok(line.trim().length > 0)
  }
  assert.ok(summary.lines[0].includes('8 tâches actives'))
  assert.ok(summary.lines[1].includes('2 à risque'))
  assert.ok(summary.lines[3].includes('Alice'))

  // fenêtre de risque paramétrée, jamais codée en dur dans le calcul
  assert.equal(DASHBOARD_RISK_WINDOW_DAYS, 7)
  const far = task({ id: 60, stage_id: 9, name: 'Prio 3 lointaine', priority: 3, deadline: '2026-12-01' })
  assert.equal(buildSummary([far], TODAY).at_risk, 0, 'au-delà de la fenêtre, pas à risque')
})

test('tableau de bord: payload complet et cohérent, règles de calcul affichées', () => {
  const dashboard = buildDashboard(DASH_TASKS, TODAY)
  assert.equal(dashboard.summary.total, DASH_TASKS.length)
  assert.equal(
    dashboard.by_stage.reduce((sum, bar) => sum + bar.count, 0),
    dashboard.summary.open,
  )
  assert.equal(dashboard.by_assignee_total.reduce((sum, bar) => sum + bar.count, 0), DASH_TASKS.length)
  assert.equal(dashboard.by_assignee_open.reduce((sum, bar) => sum + bar.count, 0), dashboard.summary.open)
  for (const value of Object.values(dashboard.rules)) {
    assert.ok(value.length > 0, 'chaque règle affichée doit être expliquée')
  }
  // vue cockpit : le nouveau bloc ne lit ni l'environnement ni la projection
  const dashboardView = read('src/components/modules/operations-dashboard.tsx')
  assert.equal(dashboardView.includes('process.env'), false)
  assert.equal(dashboardView.includes('recharts'), false, 'aucune dépendance de graphique ajoutée')
  const shell = read('src/components/modules/operations-tasks.tsx')
  assert.match(shell, /<Tabs\s+value=\{tab\}/)
  assert.match(shell, /value="dashboard"/)
  assert.match(shell, /value="tasks"/)
})

// ═════════════════════════════════════════════════════════════════════════
// Ouverture d'un segment vers la liste des tâches
// ═════════════════════════════════════════════════════════════════════════

test('ouverture d\'un segment: le compte affiché et la liste ouverte coïncident', () => {
  const summary = buildSummary(DASH_TASKS, TODAY)
  assert.ok(summary.lines.length > 0)
  const pairs: [DashboardFacet, number][] = [
    [{ kind: 'open' }, summary.open],
    [{ kind: 'late' }, summary.late],
    [{ kind: 'blocked' }, summary.blocked],
    [{ kind: 'unassigned' }, summary.unassigned],
    [{ kind: 'decisions' }, summary.decisions_open],
    [{ kind: 'initiatives' }, summary.initiatives_open],
  ]
  for (const [facet, count] of pairs) {
    const listed = selectFacet(DASH_TASKS, facet, TODAY)
    assert.equal(listed.length, count, `${facet.kind} : ${listed.length} listées pour ${count} annoncés`)
    // jamais de doublon, jamais de tâche étrangère au filtre
    assert.equal(new Set(listed.map((entry) => entry.id)).size, listed.length)
  }
})

test('ouverture d\'un segment: initiatives ouvertes = total, pas le bloc plafonné', () => {
  // 3 chantiers parents ouverts, le bloc n'en liste que 6 au maximum : ici 3
  const many = [
    task({ id: 70, stage_id: 9, name: 'Chantier A' }),
    task({ id: 71, stage_id: 8, name: 'a1', parent_id: 70 }),
    task({ id: 72, stage_id: 9, name: 'Chantier B' }),
    task({ id: 73, stage_id: 8, name: 'b1', parent_id: 72 }),
    task({ id: 74, stage_id: 9, name: 'Chantier C' }),
    task({ id: 75, stage_id: 8, name: 'c1', parent_id: 74 }),
    // chantier terminé : hors du filtre « en cours »
    task({ id: 76, stage_id: 12, name: 'Chantier D' }),
    task({ id: 77, stage_id: 8, name: 'd1', parent_id: 76 }),
  ]
  const summary = buildSummary(many, TODAY)
  assert.equal(summary.initiatives_open, 3, 'les 3 chantiers ouverts, pas le bloc plafonné')
  const listed = selectFacet(many, { kind: 'initiatives' }, TODAY)
  assert.deepEqual(listed.map((entry) => entry.id), [70, 72, 74])
  assert.equal(
    listed.some((entry) => entry.id === 76),
    false,
    'un chantier terminé ne s\'ouvre pas',
  )
})

test('ouverture d\'un segment: la fenêtre montre 10 tâches puis palier de 10', () => {
  assert.equal(DASHBOARD_FACET_PAGE_SIZE, 10)
  // 25 tâches bloquées : 10 visibles, +10, +5
  const many = Array.from({ length: 25 }, (_, index) =>
    task({ id: 100 + index, stage_id: 10, name: `Bloquée ${index}` }),
  )
  const listed = selectFacet(many, { kind: 'blocked' }, TODAY)
  assert.equal(listed.length, 25)

  const page1 = listed.slice(0, DASHBOARD_FACET_PAGE_SIZE)
  const page2 = listed.slice(0, DASHBOARD_FACET_PAGE_SIZE * 2)
  const all = listed
  assert.equal(page1.length, 10)
  assert.equal(page2.length, 20)
  assert.equal(all.length, 25)
  // les paliers sont cumulatifs et sans trou ni doublon
  assert.deepEqual(page1.map((entry) => entry.id), all.slice(0, 10).map((entry) => entry.id))
  assert.equal(new Set(all.map((entry) => entry.id)).size, 25)
})

test('ouverture d\'un segment: par étape et par responsable, même filtre que la barre', () => {
  // la liste d\'une barre doit rendre exactement le compte de la barre
  for (const bar of buildStageBars(DASH_TASKS)) {
    const listed = selectFacet(DASH_TASKS, { kind: 'stage', key: bar.key as never }, TODAY)
    assert.equal(listed.length, bar.count, `étape ${bar.key}`)
  }
  for (const bar of buildAssigneeBars(DASH_TASKS, 'open')) {
    const listed = selectFacet(
      DASH_TASKS,
      { kind: 'assignee', key: bar.key, openOnly: true },
      TODAY,
    )
    assert.equal(listed.length, bar.count, `responsable ouvert ${bar.key}`)
    // charge ouverte : jamais de tâche terminée
    assert.equal(
      listed.every((entry) => !entry.is_terminal),
      true,
    )
  }
  // le total d'un responsable inclut les terminées, la charge ouverte non
  const alice = selectFacet(DASH_TASKS, { kind: 'assignee', key: 'Alice', openOnly: false }, TODAY)
  const aliceOpen = selectFacet(DASH_TASKS, { kind: 'assignee', key: 'Alice', openOnly: true }, TODAY)
  assert.equal(alice.length > aliceOpen.length, true)
})

test('ouverture d\'un segment: identité de clé unique par segment', () => {
  const keys = [
    facetKey({ kind: 'open' }),
    facetKey({ kind: 'late' }),
    facetKey({ kind: 'stage', key: 'bloque' }),
    facetKey({ kind: 'stage', key: 'en_cours' }),
    facetKey({ kind: 'assignee', key: 'Alice', openOnly: true }),
    facetKey({ kind: 'assignee', key: 'Alice', openOnly: false }),
  ]
  assert.equal(new Set(keys).size, keys.length, 'deux segments distincts ne partagent pas une clé')
  // une tuile et une barre ne peuvent pas ouvrir le même segment par erreur
  assert.notEqual(
    facetKey({ kind: 'stage', key: 'bloque' }),
    facetKey({ kind: 'blocked' }),
  )
  // chaque type de segment a un libellé lisible
  for (const kind of [
    'open', 'late', 'blocked', 'unassigned', 'decisions', 'initiatives',
    'stage', 'assignee', 'total', 'bucket',
  ] as const) {
    assert.ok(FACET_LABEL[kind].length > 0, `${kind} sans libellé`)
  }
})

test('ouverture d\'un segment: le facet « bucket » liste exactement le KPI annoncé', () => {
  // C'est la garantie qui rend le clic sur un KPI de l'onglet Tâches honnête :
  // selectFacet passe par bucketOf, la fonction qui a produit le KPI.
  const tasks = [
    task({ id: 1, stage_id: 20 }),
    task({ id: 2, stage_id: 12 }),
    task({ id: 3, stage_id: 8, deadline: '2026-09-01' }),
    task({ id: 4, stage_id: 8, deadline: TODAY }),
    task({ id: 5, stage_id: 10 }),
    task({ id: 6, stage_id: 8 }),
    task({ id: 7, stage_id: 9, deadline: '2026-10-01' }),
    task({ id: 8, stage_id: 9, deadline: '2027-01-01' }),
    task({ id: 9, stage_id: 9 }),
  ]
  const { buckets } = assignBuckets(tasks, TODAY)
  const kpis = computeKpis(buckets, tasks.length)

  const pairs: [TaskBucket, number][] = [
    ['late', kpis.late],
    ['today', kpis.today],
    ['intervention', kpis.intervention],
    ['a_planifier', kpis.a_planifier],
    ['j14', kpis.j14],
  ]
  for (const [bucket, count] of pairs) {
    const listed = selectFacet(tasks, { kind: 'bucket', bucket }, TODAY)
    assert.equal(listed.length, count, `${bucket} : ${listed.length} listées pour ${count} annoncés`)
  }
  // « Total » ouvre tout, terminées comprises : c'est ce que son libellé annonce
  assert.equal(selectFacet(tasks, { kind: 'total' }, TODAY).length, kpis.total)
  // une section et son KPI portent la même clé : la fenêtre repart de 10
  assert.notEqual(facetKey({ kind: 'bucket', bucket: 'late' }), facetKey({ kind: 'bucket', bucket: 'j14' }))
  assert.notEqual(facetKey({ kind: 'bucket', bucket: 'late' }), facetKey({ kind: 'total' }))
})

test('ouverture d\'un segment: les KPI de l\'onglet Tâches ouvrent la fenêtre, sauf « Terminées »', () => {
  const view = read('src/components/modules/operations-tasks.tsx')
  // la fenêtre est montée dans l'onglet Tâches, sur la projection déjà chargée
  assert.match(view, /DrilldownDialog/)
  assert.match(view, /facet=\{facet\}/)
  assert.match(view, /tasks=\{payload\.tasks\}/)
  // chaque KPI cliquable ouvre son segment, sans second appel réseau
  assert.match(view, /onClick=\{\(\) => setFacet\(facet\)\}/)
  // « Total » ouvre tout…
  assert.match(view, /key: 'total', label: 'Total'.*facet: \{ kind: 'total' \}/)
  // …et « Terminées » reste un compteur, sans facet donc sans fenêtre
  assert.match(view, /key: 'done', label: 'Terminées', bucket: 'done', icon: CheckCircle2, facet: null/)
  // le clic ne défile plus vers la section : la fenêtre prend le relais
  assert.doesNotMatch(view, /setFocusBucket|scrollIntoView/)
  // la fenêtre est partagée, pas dupliquée dans les deux onglets
  const shared = read('src/components/modules/operations-drilldown.tsx')
  assert.match(shared, /Afficher .* de plus/)
  assert.match(shared, /Tout afficher/)
  assert.match(shared, /selectFacet/)
  const dashboard = read('src/components/modules/operations-dashboard.tsx')
  assert.match(dashboard, /from '\.\/operations-drilldown'/)
  // un seul module définit la fenêtre : pas de doublon à faire diverger
  assert.equal(countDefinitions(read('src/components/modules/operations-tasks.tsx')), 0)
})

test('affichage des listes: jamais plus de 10 lignes sans dépliage demandé', () => {
  // Règle générale de l'utilisateur : une liste de 150 tâches d'un bloc est
  // illisible. Toute liste se déplie par paliers de 10, sur demande.
  const view = read('src/components/modules/operations-tasks.tsx')
  const dialog = read('src/components/modules/operations-drilldown.tsx')

  // aucune page de 25, 50 ou 100 lignes ne peut plus être choisie
  assert.doesNotMatch(view, /PAGE_SIZES/)
  assert.doesNotMatch(view, /Lignes par page/)
  assert.doesNotMatch(view, /pageSize/)
  // plus de navigation par pages : le modèle est « 10 de plus » / « tout »
  assert.doesNotMatch(view, /Précédent/)
  assert.doesNotMatch(view, /Suivant/)
  // le palier vient d'une constante partagée, pas d'un 10 écrit en dur
  assert.match(view, /const BUCKET_SECTION_PAGE_SIZE = 10/)
  assert.match(view, /Afficher \{Math\.min\(BUCKET_SECTION_PAGE_SIZE, remaining\)\} de plus/)
  // le palier est appliqué par slice, donc jamais plus de N lignes rendues
  assert.match(view, /const visible = tasks\.slice\(0, limit\)/)
  // « Tout afficher » existe bien, sinon la liste serait inaccessible
  assert.match(view, /Tout afficher/)
  // la fenêtre de segment suit la même valeur
  assert.equal(dialog.includes('DASHBOARD_FACET_PAGE_SIZE'), true)
})

test('affichage des listes: les tâches terminées ne sont pas listées', () => {
  // Demande explicite : 92 tâches closes n'apportent rien au pilotage. Le compte
  // reste visible (KPI et tableau de bord), la liste disparaît.
  const view = read('src/components/modules/operations-tasks.tsx')
  const buckets = read('src/lib/operations/buckets.ts')

  assert.match(buckets, /export const VISIBLE_BUCKET_ORDER: readonly TaskBucket\[\] = BUCKET_ORDER\.filter/)
  assert.match(buckets, /\(bucket\) => bucket !== 'done'/)
  // les sections affichées viennent bien de cette liste, pas de BUCKET_ORDER
  assert.match(view, /visibleBuckets\.map\(\(bucket\) => \(/)
  assert.equal(view.includes('BUCKET_ORDER.map((bucket) => ('), false)
  // « done » reste compté : le filtre le classe toujours
  assert.match(buckets, /if \(TERMINAL_STAGE_KEYS\.includes\(stage\)\) return 'done'/)
})

test('affichage des listes: les non classées sont soumises au même palier', () => {
  // Cette carte vidait sa liste entière d'un bloc : c'était le seul endroit du
  // cockpit capable d'afficher plus de 150 tâches d'un coup.
  const view = read('src/components/modules/operations-tasks.tsx')
  assert.match(view, /function UnclassifiedSection/)
  assert.match(view, /const visible = tasks\.slice\(0, limit\)/)
  assert.match(view, /Tout afficher/)
  // elle reçoit la même signature de révision que les autres sections
  assert.equal((view.match(/revision=\{filterRevision\}/g) ?? []).length, 2)
})

test('ouverture d\'un segment: la vue cockpit rend 10 à la fois avec les deux options', () => {
  // La fenêtre est extraite dans son propre module : c'est là que vit la
  // pagination, donc c'est là que se vérifie « 10 à la fois ».
  const dialog = read('src/components/modules/operations-drilldown.tsx')
  assert.match(dialog, /DrilldownDialog/)
  assert.match(dialog, /selectFacet/)
  assert.match(dialog, /Afficher .* de plus/)
  assert.match(dialog, /Tout afficher/)
  // le palier vient de la constante partagée, pas d'un 10 écrit en dur
  assert.match(dialog, /DASHBOARD_FACET_PAGE_SIZE/)
  assert.match(dialog, /slice\(0, limit\)/)
  // une seule définition de la fenêtre dans tout le cockpit
  assert.equal(countDefinitions(dialog), 1)
  const view = read('src/components/modules/operations-dashboard.tsx')
  assert.match(view, /DrilldownDialog/)
  // les tuiles et les barres sont des boutons
  assert.match(view, /<button[\s\S]*?onClick=\{\(\) => onOpen\(facet\)\}/)
  assert.match(view, /onClick=\{\(\) => onOpen\(facetFor\(bar\)\)\}/)
})
