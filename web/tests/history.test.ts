// Tests du lecteur d'historique - node:test + node:assert, aucune dependance.
//
// Le contrat tient en une phrase : un fichier d'historique douteux doit se
// voir, pas casser. Chaque cas represente donc une panne reelle du job qui
// ecrit les archives, pas un cas de style.

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  HISTORY_SUPPORTED_SCHEMAS,
  HISTORY_WRITE_GRACE_MS,
  isArchiveDate,
  readHistoryFile,
  readHistorySeries,
  resolveHistoryDir,
} from '@/lib/operations/history-source'
// Utilises par la seconde moitie du fichier (assemblage du payload).
import { buildHistory, loadOperations, TREND_MIN_DAYS } from '@/lib/operations/service'
import { resetProjectionCache } from '@/lib/operations/projection-source'

// Instant fixe, volontairement different de l'heure machine : la suite doit etre
// reproductible. Les tests qui dependent du mtime d'un fichier reel calculent
// leur instant a partir de ce mtime, jamais de l'horloge.
const AUJOURDHUI = Date.parse('2026-09-27T12:00:00Z')

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'operations-history-'))
}

/** L'historique vit dans un sous-repertoire, comme en production. */
function mkdirHistory(dir: string): string {
  const chemin = join(dir, 'history')
  mkdirSync(chemin, { recursive: true })
  return chemin
}

function writeArchive(dir: string, name: string, value: unknown): string {
  const path = join(dir, name)
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
  return path
}

function archive(taches: Array<Record<string, unknown>>): Record<string, unknown> {
  return { schema_version: 1, generated_at: '2026-09-27T06:00:00Z', tasks: taches }
}

function tache(id: number, stage: string, extra: Record<string, unknown> = {}) {
  return { id, name: `Tâche ${id}`, stage_id: 8, stage_key: stage, ...extra }
}

/** `trend_blocked_by` est `string | null`. On exige la raison avant de la
 *  matcher : le test resterait sinon muet sur une raison absente. */
function raison(historique: ReturnType<typeof buildHistory>): string {
  assert.ok(historique.trend_blocked_by, 'la raison de blocage est absente')
  return historique.trend_blocked_by
}

// ── Un point ────────────────────────────────────────────────────────────────

test('une archive devient un point avec ses comptes derives', () => {
  const dir = tempDir()
  const path = writeArchive(dir, '2026-09-27.json', archive([
    tache(1, 'a_faire'),
    tache(2, 'en_cours'),
    tache(3, 'termine'),
    tache(4, 'acheve'),
    tache(5, 'annule'),
  ]))

  const { point, skip } = readHistoryFile(path, '2026-09-27')
  assert.equal(skip, null)
  assert.ok(point)
  assert.equal(point.total, 5)
  // 3 terminales (termine, acheve, annule) => 2 ouvertes
  assert.equal(point.done, 3)
  assert.equal(point.open, 2)
  assert.equal(point.date, '2026-09-27')
  assert.equal(point.generated_at, '2026-09-27T06:00:00Z')
  assert.equal(point.by_stage.a_faire, 1)
  assert.equal(point.by_stage.en_cours, 1)
  // la repartition couvre les 5 taches, sans double compte ni perte
  assert.equal(Object.values(point.by_stage).reduce((a, b) => a + b, 0), 5)
})

test('`late` se calcule par rapport à la date de l’archive, pas à aujourd’hui', () => {
  const dir = tempDir()
  const { point } = readHistoryFile(
    writeArchive(dir, '2026-09-20.json', archive([
      tache(1, 'a_faire', { deadline: '2026-09-10' }),
      tache(2, 'a_faire', { deadline: '2026-09-25' }),
      tache(3, 'termine', { deadline: '2026-09-01' }),
    ])),
    '2026-09-20',
  )
  assert.ok(point)
  // tâche 1 échue avant l'archive, tâche 2 non, tâche 3 terminale donc jamais
  // comptée en retard, meme echue
  assert.equal(point.late, 1)
})

// ── La tolérance, panne par panne ───────────────────────────────────────────

test('JSON invalide : le fichier est rejeté, pas la série entière', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', '{ ceci n est pas du json')
  writeArchive(dir, '2026-09-26.json', archive([tache(1, 'a_faire')]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.points.length, 1)
  assert.equal(serie.points[0].date, '2026-09-26')
  assert.equal(serie.skipped.length, 1)
  assert.equal(serie.skipped[0].date, '2026-09-25')
  assert.equal(serie.skipped[0].reason, 'json_invalide')
})

test('racine non-objet ou tableau : rejeté comme JSON invalide', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', '[1, 2, 3]')
  writeArchive(dir, '2026-09-26.json', '"une chaine"')

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.points.length, 0)
  assert.equal(serie.skipped.length, 2)
  for (const saut of serie.skipped) assert.equal(saut.reason, 'json_invalide')
})

test('schema inconnu : rejeté avec le numéro, pour savoir quoi déployer', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', {
    schema_version: 2,
    generated_at: 'x',
    tasks: [tache(1, 'a_faire')],
  })

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.points.length, 0)
  assert.equal(serie.skipped[0].reason, 'schema_inconnu')
  assert.match(serie.skipped[0].detail, /schema_version 2/)
  // le lecteur dit ce qu'il sait lire : ce sera la trace du test de la v2
  assert.deepEqual(HISTORY_SUPPORTED_SCHEMAS, [1])
})

test('champ `tasks` absent : rejeté, pas lu comme zéro tâche', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', { schema_version: 1, generated_at: 'x' })

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.points.length, 0)
  assert.equal(serie.skipped[0].reason, 'sans_taches')
})

test('archive partiellement lisible : le point est gardé, l’écart est signalé', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', archive([
    tache(1, 'a_faire'),
    { name: 'sans identifiant', stage_key: 'a_faire' },
    tache(2, 'termine'),
  ]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  // une tache perdue ne doit pas faire perdre le point entier
  assert.equal(serie.points.length, 1)
  assert.equal(serie.points[0].total, 2)
  assert.equal(serie.skipped.length, 1)
  assert.equal(serie.skipped[0].reason, 'illisible')
  assert.match(serie.skipped[0].detail, /1 tâche/)
})

test('archive vide (`tasks: []`) : un point valide à zéro', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', archive([]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  // zéro tâche est un fait possible, pas une panne : on ne le masque pas
  assert.equal(serie.points.length, 1)
  assert.equal(serie.points[0].total, 0)
  assert.equal(serie.skipped.length, 0)
})

// ── Fichiers parasites et écriture en cours ─────────────────────────────────

test('fichier écrit à l’instant : ignoré pendant la marge d’écriture', () => {
  const dir = tempDir()
  const path = writeArchive(dir, '2026-09-27.json', archive([tache(1, 'a_faire')]))

  // L'instant se derive du mtime REEL du fichier, pas de l'horloge : sinon le
  // test depend de l'heure a laquelle il tourne.
  const mtime = statSync(path).mtimeMs

  const pendant = readHistorySeries({ dir, now: () => mtime + 1000 })
  assert.equal(pendant.points.length, 0)
  assert.equal(pendant.skipped[0].reason, 'en_cours_ecriture')
  assert.match(pendant.skipped[0].detail, /1 s/)

  // passe la marge, le meme fichier se lit
  const apres = readHistorySeries({
    dir,
    now: () => mtime + HISTORY_WRITE_GRACE_MS + 1000,
  })
  assert.equal(apres.points.length, 1)
  assert.equal(apres.points[0].total, 1)
  assert.equal(apres.skipped.length, 0)
})

test('noms de fichiers parasites : ignorés silencieusement', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', archive([tache(1, 'a_faire')]))
  writeArchive(dir, 'pas-une-date.json', archive([tache(2, 'a_faire')]))
  writeArchive(dir, '2026-13-45.json', archive([tache(3, 'a_faire')]))
  writeFileSync(join(dir, 'operations-tasks.json.tmp'), 'bruit', 'utf8')
  writeFileSync(join(dir, 'README.md'), '# archives', 'utf8')

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.points.length, 1)
  assert.equal(serie.points[0].date, '2026-09-25')
  // un fichier parasite n'est pas une panne : il ne doit pas polluer `skipped`
  assert.equal(serie.skipped.length, 0)
})

test('une date de calendrier impossible ne date pas un point', () => {
  // le nom de fichier est la seule chose qui date un point. `2026-02-30`
  // passerait le test de `isIsoDate` du cockpit — JavaScript le fait glisser au
  // 2 mars — et placerait le point au mauvais jour dans la serie.
  assert.equal(isArchiveDate('2026-09-25'), true)
  assert.equal(isArchiveDate('2026-02-30'), false)
  assert.equal(isArchiveDate('2026-13-45'), false)
  assert.equal(isArchiveDate('2026-00-10'), false)
  assert.equal(isArchiveDate('2026-09-32'), false)
  assert.equal(isArchiveDate('2026-9-5'), false)
  assert.equal(isArchiveDate('25-09-2026'), false)
  assert.equal(isArchiveDate('2024-02-29'), true) // année bissextile
  assert.equal(isArchiveDate('2026-02-29'), false) // année non bissextile
})

test('répertoire d’historique absent : série vide, pas d’erreur', () => {
  const serie = readHistorySeries({ dir: join(tempDir(), 'jamais-cree'), now: () => AUJOURDHUI })
  assert.equal(serie.points.length, 0)
  assert.equal(serie.first_date, null)
  assert.equal(serie.coverage, 0)
  assert.equal(serie.span, 0)
  assert.equal(serie.skipped.length, 0)
})

// ── La série et sa longueur ────────────────────────────────────────────────

test('les points sont triés par date, quel que soit l’ordre de lecture', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-25.json', archive([tache(1, 'a_faire')]))
  writeArchive(dir, '2026-09-23.json', archive([tache(1, 'a_faire'), tache(2, 'a_faire')]))
  writeArchive(dir, '2026-09-26.json', archive([tache(1, 'a_faire')]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.deepEqual(serie.points.map((p) => p.date), ['2026-09-23', '2026-09-25', '2026-09-26'])
})

test('`coverage` va du premier point à aujourd’hui, `span` reste dans les points', () => {
  const dir = tempDir()
  // trois points, du 22 au 26, sur un instant fixé au 27
  writeArchive(dir, '2026-09-22.json', archive([tache(1, 'a_faire')]))
  writeArchive(dir, '2026-09-25.json', archive([tache(1, 'a_faire')]))
  writeArchive(dir, '2026-09-26.json', archive([tache(1, 'a_faire')]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.days_covered, 3)
  assert.equal(serie.first_date, '2026-09-22')
  assert.equal(serie.last_date, '2026-09-26')
  assert.equal(serie.coverage, 5) // 22 -> 27, longueur reelle de la serie
  assert.equal(serie.span, 4) // 22 -> 26, etendue des points eux-memes
})

test('un trou au milieu se voit dans les dates, sans être comblé', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-20.json', archive([tache(1, 'a_faire')]))
  // 21 et 22 manquent
  writeArchive(dir, '2026-09-23.json', archive([tache(1, 'a_faire')]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.days_covered, 2)
  assert.equal(serie.coverage, 7) // 20 -> 27
  assert.equal(serie.span, 3) // 20 -> 23
  // le trou est reconstructible par le consommateur : les dates le disent
  const dates = serie.points.map((p) => p.date)
  assert.equal(dates.includes('2026-09-21'), false)
  assert.equal(dates.includes('2026-09-22'), false)
})

test('une série qui s’arrête avant aujourd’hui se distingue d’une série complète', () => {
  const dir = tempDir()
  writeArchive(dir, '2026-09-26.json', archive([tache(1, 'a_faire')]))

  const serie = readHistorySeries({ dir, now: () => AUJOURDHUI, graceMs: 0 })
  assert.equal(serie.last_date, '2026-09-26')
  // la serie ne va pas jusqu'a aujourd'hui : `span` < `coverage`
  assert.equal(serie.span, 0)
  assert.equal(serie.coverage, 1)
})

test('le jour de référence est celui de Casablanca, pas celui de l’UTC', () => {
  const dir = tempDir()
  // 23:30 UTC = 00:30 le lendemain a Casablanca (UTC+1) : l'archive du 28 existe
  // deja, la serie est donc a jour. En UTC, le lecteur la declarerait arretee.
  const instant = Date.parse('2026-09-27T23:30:00Z')
  ecrireSerie(dir, ['2026-09-27', '2026-09-28'])

  const serie = readHistorySeries({ dir, now: () => instant, graceMs: 0 })
  assert.equal(serie.last_date, '2026-09-28')
  // 27 -> 28 en heure locale : `coverage` vaut 1, pas 0 comme le donnerait l'UTC
  assert.equal(serie.coverage, 1)
  assert.equal(serie.span, 1)
  // invariant utilise par buildHistory : coverage > span => serie arretee
  assert.equal(serie.coverage > serie.span, false)
  // trop courte pour une tendance, mais pas arretee : la raison le dit
  assert.match(raison(buildHistory(serie)), /14 requis/)
})

// ── Résolution du chemin ────────────────────────────────────────────────────

test('le répertoire d’historique se configure par variable d’environnement', () => {
  const asEnv = (values: Record<string, string>) => values as NodeJS.ProcessEnv
  assert.equal(resolveHistoryDir('/srv/web', asEnv({})), '/srv/web/.data/history')
  assert.equal(
    resolveHistoryDir('/srv/web', asEnv({ OPERATIONS_TASKS_HISTORY_DIR: '/donnees/archives' })),
    '/donnees/archives',
  )
  assert.equal(
    resolveHistoryDir('/srv/web', asEnv({ OPERATIONS_TASKS_HISTORY_DIR: '  ' })),
    '/srv/web/.data/history',
  )
  assert.equal(
    resolveHistoryDir('/srv/web', asEnv({ OPERATIONS_TASKS_HISTORY_DIR: 'ailleurs' })),
    '/srv/web/ailleurs',
  )
})

const INSTANT = Date.parse('2026-09-27T12:00:00Z')

function ecrireSerie(dir: string, dates: string[]): void {
  for (const date of dates) {
    writeFileSync(
      join(dir, `${date}.json`),
      JSON.stringify({ schema_version: 1, generated_at: `${date}T06:00:00Z`, tasks: [tache(1, 'a_faire')] }),
      'utf8',
    )
  }
}

const VIDE = {
  points: [],
  skipped: [],
  first_date: null,
  last_date: null,
  coverage: 0,
  span: 0,
  days_covered: 0,
}

test('aucune archive : un etat normal, pas une panne, et la raison est dite', () => {
  const historique = buildHistory(VIDE)
  assert.equal(historique.trend_ready, false)
  assert.equal(historique.days_covered, 0)
  assert.equal(historique.first_date, null)
  assert.match(raison(historique), /Aucune archive/)
})

test('aucune archive lisible : la raison distingue « pas encore » de « toutes rejetees »', () => {
  const sansAucune = buildHistory(VIDE)
  const toutesRejetees = buildHistory({
    ...VIDE,
    skipped: [{ date: '2026-09-26', reason: 'json_invalide', detail: 'coupure' }],
  })
  assert.match(raison(sansAucune), /prochain passage/)
  assert.match(raison(toutesRejetees), /toutes les archives présentes ont été rejetées/)
})

test('serie trop courte pour une tendance, mais exploitable en relevé', () => {
  const dir = tempDir()
  ecrireSerie(dir, ['2026-09-25', '2026-09-26', '2026-09-27'])
  const serie = readHistorySeries({ dir, now: () => INSTANT, graceMs: 0 })

  const historique = buildHistory(serie)
  assert.equal(historique.days_covered, 3)
  assert.equal(historique.trend_ready, false)
  assert.match(raison(historique), new RegExp(`3 jour\\(s\\).*${TREND_MIN_DAYS} requis`))
  // les points restent disponibles : un releve n'est pas perdu
  assert.equal(historique.points.length, 3)
})

test('serie assez longue et à jour : la tendance devient possible', () => {
  const dir = tempDir()
  const dates = [
    '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
    '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22',
    '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
  ]
  ecrireSerie(dir, dates)
  const serie = readHistorySeries({ dir, now: () => INSTANT, graceMs: 0 })

  const historique = buildHistory(serie)
  assert.equal(historique.trend_ready, true)
  assert.equal(historique.trend_blocked_by, null)
  assert.equal(historique.days_covered, 15)
  assert.equal(historique.first_date, '2026-09-13')
  assert.equal(historique.last_date, '2026-09-27')
})

test('serie longue mais arrêtée avant aujourd’hui : la tendance reste bloquée', () => {
  const dir = tempDir()
  // 14 points, mais le dernier est du 20 : la projection a peut-être cessé
  // de tourner. Une courbe qui continue quand même mentirait.
  ecrireSerie(dir, [
    '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15',
    '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
  ])
  const serie = readHistorySeries({ dir, now: () => INSTANT, graceMs: 0 })

  const historique = buildHistory(serie)
  assert.equal(historique.days_covered, 15)
  assert.equal(historique.last_date, '2026-09-20')
  assert.equal(historique.trend_ready, false)
  assert.match(raison(historique), /arrêtée au 2026-09-20/)
})

test('les points du payload portent les comptes, pas les tâches entières', () => {
  const dir = tempDir()
  ecrireSerie(mkdirHistory(dir), ['2026-09-26', '2026-09-27'])
  const serie = readHistorySeries({ dir: mkdirHistory(dir), now: () => INSTANT, graceMs: 0 })

  const historique = buildHistory(serie)
  // un point de payload ne transporte pas `tasks` : 232 tâches par point et par
  // jour gonflerait la reponse pour rien
  for (const point of historique.points) {
    assert.equal((point as Record<string, unknown>).tasks, undefined)
    assert.equal(typeof point.total, 'number')
    assert.equal(typeof point.by_stage, 'object')
  }
})

test('le payload du cockpit porte l’historique, et il suit le répertoire configuré', async () => {
  const dir = tempDir()
  ecrireSerie(mkdirHistory(dir), ['2026-09-26', '2026-09-27'])
  const asEnv = (values: Record<string, string>) => values as NodeJS.ProcessEnv

  // projection valide + historique dans un sous-repertoire, comme en production
  writeFileSync(
    join(dir, 'operations-tasks.json'),
    JSON.stringify({
      schema_version: 1,
      generated_at: '2026-09-27T11:00:00Z',
      stage_map: {},
      tasks: [tache(1, 'a_faire')],
    }),
    'utf8',
  )
  mkdirHistory(dir)

  resetProjectionCache()
  const { payload } = await loadOperations({
    now: new Date(INSTANT),
    env: asEnv({
      OPERATIONS_TASKS_PROJECTION_PATH: join(dir, 'operations-tasks.json'),
      OPERATIONS_TASKS_HISTORY_DIR: join(dir, 'history'),
    }),
  })

  assert.ok(payload.history, 'le payload ne porte pas d’historique')
  assert.equal(payload.history.days_covered, 2)
  assert.equal(payload.history.last_date, '2026-09-27')
  assert.equal(payload.history.trend_ready, false)
  resetProjectionCache()
})

test('un cockpit qui ne veut que la projection courante peut ignorer l’historique', async () => {
  const dir = tempDir()
  mkdirHistory(dir)
  writeFileSync(
    join(dir, 'operations-tasks.json'),
    JSON.stringify({
      schema_version: 1,
      generated_at: '2026-09-27T11:00:00Z',
      stage_map: {},
      tasks: [tache(1, 'a_faire')],
    }),
    'utf8',
  )
  resetProjectionCache()
  const asEnv = (values: Record<string, string>) => values as NodeJS.ProcessEnv

  const { payload } = await loadOperations({
    now: new Date(INSTANT),
    history: false,
    env: asEnv({
      OPERATIONS_TASKS_PROJECTION_PATH: join(dir, 'operations-tasks.json'),
      OPERATIONS_TASKS_HISTORY_DIR: join(dir, 'history'),
    }),
  })
  assert.equal(payload.history.days_covered, 0)
  assert.equal(payload.history.trend_ready, false)
  // ne pas mentir : les archives existent, ce cockpit a choisi de ne pas les lire
  assert.match(raison(payload.history), /non demandé/)
  resetProjectionCache()
})
