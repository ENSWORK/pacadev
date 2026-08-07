import { createServer } from 'http'
import { Server } from 'socket.io'
import fs from 'fs'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)
const PACADEV_HOME = process.env.PACADEV_HOME || '/home/pacadev/.pacadev'
const DOCKER_BIN = process.env.DOCKER_BIN || '/usr/bin/docker'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// --- Load real PACADEV clients ---
function loadRealClients(): string[] {
  try {
    const data = JSON.parse(fs.readFileSync(`${PACADEV_HOME}/state/versions.json`, 'utf-8'))
    return Object.keys(data.clients || {})
  } catch {
    return ['afrequip', 'mecafric', 'specta']
  }
}

interface DockerStats { cpu: number; memPercent: number; running: boolean }

async function getDockerStats(slug: string): Promise<DockerStats> {
  try {
    const { stdout } = await execAsync(
      `${DOCKER_BIN} stats --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}" ${slug}_odoo`,
      { encoding: 'utf-8', timeout: 5000 },
    )
    const out = stdout.trim()
    if (!out) return { cpu: 0, memPercent: 0, running: false }
    const [cpuStr, memStr] = out.split('\t')
    return { cpu: parseFloat(cpuStr) || 0, memPercent: parseFloat(memStr) || 0, running: true }
  } catch {
    return { cpu: 0, memPercent: 0, running: false }
  }
}

async function getAllDockerStats(clients: string[]): Promise<{ slug: string; stats: DockerStats }[]> {
  return Promise.all(clients.map(async (slug) => ({ slug, stats: await getDockerStats(slug) })))
}

function tailAuditLog(lines = 5): object[] {
  try {
    const data = fs.readFileSync(`${PACADEV_HOME}/state/audit-log.jsonl`, 'utf-8')
    return data.trim().split('\n').filter(Boolean).slice(-lines).map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

const generateId = () => Math.random().toString(36).substring(2, 11)

// --- Room management ---
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  socket.on('join', (room: string) => {
    socket.join(room)
    console.log(`[WS] ${socket.id} joined room: ${room}`)
  })

  socket.on('leave', (room: string) => {
    socket.leave(room)
    console.log(`[WS] ${socket.id} left room: ${room}`)
  })

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() })
  })

  // Send initial audit snapshot on connect
  const recentAudit = tailAuditLog(10)
  socket.emit('audit:snapshot', { logs: recentAudit, timestamp: new Date().toISOString() })

  // Send current pipeline status snapshot on connect
  for (const [slug, cached] of Object.entries(pipelineCache)) {
    socket.emit('pipeline:status', {
      client: slug,
      runId: cached.runId,
      status: cached.status,
      conclusion: cached.conclusion,
      timestamp: new Date().toISOString(),
    })
  }

  socket.on('error', (error) => {
    console.error(`[WS] Socket error (${socket.id}):`, error)
  })
})

// --- Real periodic events ---

// Every 10s: Docker metrics (async, non bloquant pour l'event loop)
let metricsCycleRunning = false
setInterval(async () => {
  if (metricsCycleRunning) return
  metricsCycleRunning = true
  try {
    const results = await getAllDockerStats(loadRealClients())
    for (const { slug, stats } of results) {
      const event = {
        client: slug,
        cpu: stats.cpu,
        memPercent: stats.memPercent,
        containerRunning: stats.running,
        timestamp: new Date().toISOString(),
      }
      io.to(`metrics:${slug}`).emit('metrics:update', event)
      io.emit('metrics:update', event)
    }
  } catch { /* ignore */ } finally {
    metricsCycleRunning = false
  }
}, 10_000)

// Every 20s: Audit log tail (new entries)
let lastAuditCount = 0
setInterval(() => {
  try {
    const logs = tailAuditLog(20)
    if (logs.length > lastAuditCount) {
      const newEntries = logs.slice(lastAuditCount)
      lastAuditCount = logs.length
      for (const entry of newEntries) {
        io.emit('audit:new', { ...entry, timestamp: new Date().toISOString() })
      }
    }
  } catch { /* ignore */ }
}, 20_000)

// Every 30s: Docker container health check (async)
let alertsCycleRunning = false
setInterval(async () => {
  if (alertsCycleRunning) return
  alertsCycleRunning = true
  try {
    const results = await getAllDockerStats(loadRealClients())
    for (const { slug, stats } of results) {
      if (!stats.running) {
        const alert = {
          id: `alert-${generateId()}`,
          clientId: slug,
          level: 'critical',
          message: `Container ${slug}_odoo non actif`,
          source: 'Docker',
          timestamp: new Date().toISOString(),
        }
        io.to(`alerts:${slug}`).emit('alert:new', alert)
        io.emit('alert:new', alert)
        console.log(`[EVENT] alert:new → level=critical, client=${slug}, container down`)
      }
    }
  } catch { /* ignore */ } finally {
    alertsCycleRunning = false
  }
}, 30_000)

// --- Real GitHub Actions pipeline stream (status + logs) ---

function getClientRepoBranch(slug: string): { repo: string; branch: string | null } {
  try {
    const data = JSON.parse(fs.readFileSync(`${PACADEV_HOME}/state/versions.json`, 'utf-8'))
    const client = data.clients?.[slug] || {}
    return { repo: client.current_repo || 'ENSWORK/pacadev', branch: client.current_branch || null }
  } catch {
    return { repo: 'ENSWORK/pacadev', branch: null }
  }
}

function parseLogLines(raw: string): Array<{ time: string; level: string; msg: string }> {
  return raw
    .split('\n')
    .filter(Boolean)
    .slice(-1500)
    .map((line) => {
      const m =
        line.match(/^([^\t]+)\t([^\t]+)\t(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/) ||
        line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/)
      if (!m) return { time: '', level: 'INFO', msg: line.slice(0, 300) }
      const time = m[3].replace('T', ' ').replace('Z', '')
      const content = m[4]
      const prefix = m[1] && m[2] ? `${m[1]} › ${m[2]}` : ''
      let level = 'INFO'
      if (/error|fail|exception|traceback|exit code 1/i.test(content)) level = 'ERROR'
      else if (/warn/i.test(content)) level = 'WARNING'
      else if (/success|passed|✓|complete|terminé/i.test(content)) level = 'SUCCESS'
      return { time, level, msg: prefix ? `${prefix} — ${content}` : content.slice(0, 300) }
    })
}

interface PipelineStreamCache { runId: string; status: string; conclusion: string | null; emittedLines: number }
const pipelineCache: Record<string, PipelineStreamCache> = {}

async function streamPipeline(slug: string): Promise<void> {
  const { repo, branch } = getClientRepoBranch(slug)
  const listArgs = ['run', 'list', '--repo', repo, '--limit', '3', '--json', 'databaseId,status,conclusion,headBranch,displayTitle,url,createdAt']
  if (branch) listArgs.push('--branch', branch)
  try {
    const { stdout } = await execFileAsync('gh', listArgs, { encoding: 'utf-8', timeout: 15000 })
    const runs: Array<{ databaseId: number; status: string; conclusion: string | null; headBranch: string; displayTitle: string; url: string; createdAt: string }> = JSON.parse(stdout || '[]')
    if (!runs.length) return
    console.log(`[EVENT] pipeline cycle → ${slug}: ${runs.length} runs (dernier: #${runs[0].databaseId} ${runs[0].status})`)

    const active = runs.find((r) => r.status === 'in_progress' || r.status === 'queued')
    const run = active || runs[0]
    const runId = String(run.databaseId)
    const prev = pipelineCache[slug]
    const firstSeen = !prev || prev.runId !== runId
    const statusChanged = !prev || prev.status !== run.status || prev.conclusion !== run.conclusion

    if (firstSeen || statusChanged) {
      pipelineCache[slug] = { runId, status: run.status, conclusion: run.conclusion, emittedLines: 0 }
      io.emit('pipeline:status', {
        client: slug,
        runId,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.headBranch,
        title: run.displayTitle,
        url: run.url,
        createdAt: run.createdAt,
        timestamp: new Date().toISOString(),
      })
      console.log(`[EVENT] pipeline:status → client=${slug}, run=${runId}, status=${run.status}, conclusion=${run.conclusion}`)
    }

    if (run.status === 'in_progress') {
      const cur = pipelineCache[slug]!
      const { stdout: raw } = await execFileAsync(
        'gh', ['run', 'view', runId, '--repo', repo, '--log'],
        { encoding: 'utf-8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 },
      )
      const lines = parseLogLines(raw)
      if (lines.length > cur.emittedLines) {
        const fresh = lines.slice(cur.emittedLines)
        cur.emittedLines = lines.length
        io.emit('pipeline:logs', { client: slug, runId, lines: fresh, timestamp: new Date().toISOString() })
      }
    }
  } catch (err) {
    const e = err as { message?: string; stderr?: string }
    console.log(`[EVENT] pipeline cycle → ${slug}: erreur (${(e.stderr || e.message || String(err)).slice(0, 400)})`)
  }
}

// Every 12s: stream real pipeline logs/status for each client (async, non bloquant)
let pipelineCycleRunning = false
setInterval(async () => {
  if (pipelineCycleRunning) return
  pipelineCycleRunning = true
  try {
    const clients = loadRealClients()
    for (const slug of clients) {
      await streamPipeline(slug)
    }
  } catch { /* ignore */ } finally {
    pipelineCycleRunning = false
  }
}, 12_000)

// --- Start server ---
const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[PACADEV WS] Socket.io running on port ${PORT}`)
  console.log(`[PACADEV WS] Real clients: ${loadRealClients().join(', ')}`)
  console.log(`[PACADEV WS] Events: metrics(10s), audit(20s), health(30s), pipeline(12s)`)
})

const shutdown = () => {
  io.close()
  httpServer.close(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
