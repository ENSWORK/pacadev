// Runner de tests: transpile les fichiers TypeScript du test avec le paquet
// `typescript` deja present dans le depot, puis delegue a `node --test`.
// Aucune dependance ajoutee (Node 20.19 n'a pas de strip-types natif).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, '.data', 'test-build')
const require = createRequire(join(root, 'package.json'))
const ts = require('typescript')

const ENTRIES = ['tests/operations.test.ts', 'tests/history.test.ts']
const queue = [...ENTRIES]
const emitted = new Set()

const toPosix = (value) => value.split(sep).join('/')

function resolveSource(fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = resolve(root, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  throw new Error(`specifier introuvable : ${specifier} (depuis ${fromFile})`)
}

const SPECIFIER = /(from\s*|import\s*\(\s*)(['"])([^'"]+)\2/g

function rewriteSpecifiers(code, fromFile, outFile) {
  return code.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const target = resolveSource(fromFile, specifier)
    if (!target) return match
    queue.push(toPosix(relative(root, target)))
    const outTarget = join(outRoot, relative(root, target)).replace(/\.tsx?$/, '.mjs')
    let outSpec = toPosix(relative(dirname(outFile), outTarget))
    if (!outSpec.startsWith('.')) outSpec = `./${outSpec}`
    return `${prefix}${quote}${outSpec}${quote}`
  })
}

function emit(relativePath) {
  if (emitted.has(relativePath)) return null
  emitted.add(relativePath)
  const source = join(root, relativePath)
  const outFile = join(outRoot, relativePath).replace(/\.tsx?$/, '.mjs')
  const code = ts.transpileModule(readFileSync(source, 'utf8'), {
    fileName: source,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  }).outputText
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, rewriteSpecifiers(code, source, outFile), 'utf8')
  return outFile
}

rmSync(outRoot, { recursive: true, force: true })
// seuls les points d'entrée sont exécutés par `node --test`; les modules
// importés sont transpilés dans la boucle mais ne sont pas des fichiers de test
const entryOutputs = ENTRIES.map(emit).filter(Boolean)
for (let index = 0; index < queue.length; index += 1) emit(queue[index])

const result = spawnSync(process.execPath, ['--test', ...entryOutputs], {
  stdio: 'inherit',
  env: { ...process.env, OPERATIONS_REPO_ROOT: root },
})
process.exit(result.status ?? 1)
