import { createServer } from 'http'
import { Server } from 'socket.io'
import fs from 'fs'
import { execSync } from 'child_process'

const PACADEV_HOME = process.env.PACADEV_HOME || '/home/abdelali/.pacadev'
const DOCKER_BIN = process.env.DOCKER_BIN || '/usr/bin/docker'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

function loadRealClients() {
  try {
    const data = JSON.parse(fs.readFileSync(`${PACADEV_HOME}/state/versions.json`, 'utf-8'))
    return Object.keys(data.clients || {})
  } catch {
    return ['afrequip', 'mecafric', 'specta']
  }
}

function getDockerStats(slug) {
  try {
    const out = execSync(`${DOCKER_BIN} stats --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}" ${slug}_odoo`, {
      encoding: 'utf-8', timeout: 5000,
    }).trim()
    if (!out) return { cpu: 0, memPercent: 0, running: false }
    const [cpuStr, memStr] = out.split('\t')
    return { cpu: parseFloat(cpuStr) || 0, memPercent: parseFloat(memStr) || 0, running: true }
  } catch {
    return { cpu: 0, memPercent: 0, running: false }
  }
}

function tailAuditLog(lines = 5) {
  try {
    const data = fs.readFileSync(`${PACADEV_HOME}/state/audit-log.jsonl`, 'utf-8')
    return data.trim().split('\n').filter(Boolean).slice(-lines).map(l => JSON.parse(l))
  } catch {
    return []
  }
}

const generateId = () => Math.random().toString(36).substring(2, 11)

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  socket.on('join', (room) => {
    socket.join(room)
    console.log(`[WS] ${socket.id} joined room: ${room}`)
  })

  socket.on('leave', (room) => {
    socket.leave(room)
    console.log(`[WS] ${socket.id} left room: ${room}`)
  })

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() })
  })

  const recentAudit = tailAuditLog(10)
  socket.emit('audit:snapshot', { logs: recentAudit, timestamp: new Date().toISOString() })

  socket.on('error', (error) => {
    console.error(`[WS] Socket error (${socket.id}):`, error)
  })
})

// Every 10s: Docker metrics
setInterval(() => {
  const clients = loadRealClients()
  for (const slug of clients) {
    const stats = getDockerStats(slug)
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
}, 10_000)

// Every 20s: Audit log new entries
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

// Every 30s: Container health alerts
setInterval(() => {
  const clients = loadRealClients()
  for (const slug of clients) {
    const stats = getDockerStats(slug)
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
    }
  }
}, 30_000)

// Every 45s: Pipeline ping
setInterval(() => {
  const clients = loadRealClients()
  const slug = clients[Math.floor(Math.random() * clients.length)]
  if (!slug) return
  io.to(`pipeline:${slug}`).emit('pipeline:ping', {
    client: slug,
    timestamp: new Date().toISOString(),
    message: 'Pipeline status check',
  })
}, 45_000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[PACADEV WS] Socket.io running on port ${PORT}`)
  console.log(`[PACADEV WS] Real clients: ${loadRealClients().join(', ')}`)
  console.log(`[PACADEV WS] Events: metrics(10s), audit(20s), health(30s), pipeline(45s)`)
})

const shutdown = () => {
  io.close()
  httpServer.close(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
