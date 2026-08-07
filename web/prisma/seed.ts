import { db } from '@/lib/db'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create services
  const services = [
    { name: 'Docker Engine', type: 'docker', status: 'up', url: 'unix:///var/run/docker.sock' },
    { name: 'Traefik Proxy', type: 'traefik', status: 'up', url: 'http://traefik:8080' },
    { name: 'Tailscale Network', type: 'tailscale', status: 'degraded', url: 'http://tailscale:9002' },
    { name: 'PostgreSQL Primary', type: 'db', status: 'up', url: 'postgresql://db:5432' },
    { name: 'PostgreSQL Replica', type: 'db', status: 'up', url: 'postgresql://db-replica:5432' },
    { name: 'Redis Cache', type: 'docker', status: 'up', url: 'redis://redis:6379' },
  ]

  for (const svc of services) {
    await db.serviceHealth.upsert({
      where: { id: `svc_${svc.name.toLowerCase().replace(/\s+/g, '_')}` },
      update: svc,
      create: { id: `svc_${svc.name.toLowerCase().replace(/\s+/g, '_')}`, ...svc },
    })
  }

  // Create AI config
  await db.aIConfig.upsert({
    where: { id: 'cfg_001' },
    update: {},
    create: {
      id: 'cfg_001',
      model: 'claude-3.5-sonnet',
      maxTokens: 4000,
      fallbackModel: 'gpt-4o',
      costThreshold: 50.0,
      autoMerge: false,
      autoDeploy: false,
      autoRollback: false,
    },
  })

  // Create clients
  const clients = [
    {
      id: 'cl_001', slug: 'acmecorp', name: 'ACME Corporation', odooVersion: '17',
      status: 'prod', stagingUrl: 'https://acmecorp-staging.enswork.local',
      prodUrl: 'https://acmecorp.enswork.local', tailscaleIp: '10.200.0.11',
      aclGroup: 'group:acmecorp',
      contacts: JSON.stringify({ dev: ['dev@enswork.com'], client: ['contact@acmecorp.com'], ops: ['ops@enswork.com'] }),
    },
    {
      id: 'cl_002', slug: 'globex', name: 'Globex Industries', odooVersion: '17',
      status: 'staging', stagingUrl: 'https://globex-staging.enswork.local',
      prodUrl: 'https://globex.enswork.local', tailscaleIp: '10.200.0.12',
      aclGroup: 'group:globex',
      contacts: JSON.stringify({ dev: ['lead@enswork.com'], client: ['it@globex.com'], ops: ['ops@enswork.com'] }),
    },
    {
      id: 'cl_003', slug: 'initech', name: 'Initech Solutions', odooVersion: '14',
      status: 'prod', stagingUrl: 'https://initech-staging.enswork.local',
      prodUrl: 'https://initech.enswork.local', tailscaleIp: '10.200.0.13',
      aclGroup: 'group:initech',
      contacts: JSON.stringify({ dev: ['dev2@enswork.com'], client: ['cto@initech.com'], ops: ['ops@enswork.com'] }),
    },
    {
      id: 'cl_004', slug: 'umbrella', name: 'Umbrella Corp', odooVersion: '19',
      status: 'dev', stagingUrl: 'https://umbrella-staging.enswork.local',
      prodUrl: null, tailscaleIp: '10.200.0.14',
      aclGroup: 'group:umbrella',
      contacts: JSON.stringify({ dev: ['dev3@enswork.com'], client: ['admin@umbrella.com'], ops: ['ops@enswork.com'] }),
    },
    {
      id: 'cl_005', slug: 'wayne', name: 'Wayne Enterprises', odooVersion: '17',
      status: 'prod', stagingUrl: 'https://wayne-staging.enswork.local',
      prodUrl: 'https://wayne.enswork.local', tailscaleIp: '10.200.0.15',
      aclGroup: 'group:wayne',
      contacts: JSON.stringify({ dev: ['dev@enswork.com'], client: ['bruce@wayne.com'], ops: ['ops@enswork.com'] }),
    },
    {
      id: 'cl_006', slug: 'stark', name: 'Stark Industries', odooVersion: '17',
      status: 'staging', stagingUrl: 'https://stark-staging.enswork.local',
      prodUrl: 'https://stark.enswork.local', tailscaleIp: '10.200.0.16',
      aclGroup: 'group:stark',
      contacts: JSON.stringify({ dev: ['lead@enswork.com'], client: ['tony@stark.com'], ops: ['ops@enswork.com'] }),
    },
  ]

  for (const client of clients) {
    await db.client.upsert({
      where: { id: client.id },
      update: client,
      create: client,
    })
  }

  // Create modules for acmecorp
  const modules = [
    { id: 'mod_001', clientId: 'cl_001', name: 'sale', version: '17.0.1.2', source: 'oca', status: 'installed' },
    { id: 'mod_002', clientId: 'cl_001', name: 'purchase', version: '17.0.1.1', source: 'oca', status: 'installed' },
    { id: 'mod_003', clientId: 'cl_001', name: 'acmecorp_custom', version: '1.3.0', source: 'custom', status: 'installed' },
    { id: 'mod_004', clientId: 'cl_001', name: 'account', version: '17.0.2.0', source: 'oca', status: 'upgrade_available' },
    { id: 'mod_005', clientId: 'cl_001', name: 'hr', version: '17.0.1.0', source: 'oca', status: 'disabled' },
    { id: 'mod_006', clientId: 'cl_001', name: 'acmecorp_reports', version: '2.0.1', source: 'custom', status: 'installed' },
    { id: 'mod_010', clientId: 'cl_002', name: 'sale', version: '17.0.1.2', source: 'oca', status: 'installed' },
    { id: 'mod_011', clientId: 'cl_002', name: 'globex_integration', version: '3.1.0', source: 'custom', status: 'installed' },
    { id: 'mod_012', clientId: 'cl_002', name: 'stock', version: '17.0.1.0', source: 'oca', status: 'installed' },
    { id: 'mod_020', clientId: 'cl_003', name: 'sale', version: '14.0.3.2', source: 'oca', status: 'installed' },
    { id: 'mod_021', clientId: 'cl_003', name: 'initech_portal', version: '1.0.5', source: 'custom', status: 'installed' },
  ]

  for (const mod of modules) {
    await db.clientModule.upsert({
      where: { id: mod.id },
      update: mod,
      create: mod,
    })
  }

  // Create deployments
  const deployments = [
    {
      id: 'deploy_20260513_1430', clientId: 'cl_001', environment: 'prod',
      versionTag: 'acmecorp/v17/2026.05.13-1', triggeredBy: 'admin@enswork.com',
      triggerReason: 'Feature #142 validated by client', status: 'success',
      healthWeb: 'ok', healthDb: 'ok', healthCron: 'ok', rollbackAvailable: true,
    },
    {
      id: 'deploy_20260512_1800', clientId: 'cl_002', environment: 'staging',
      versionTag: 'globex/v17/2026.05.12-1', triggeredBy: 'lead@enswork.com',
      triggerReason: 'Integration module update', status: 'success',
      healthWeb: 'ok', healthDb: 'ok', healthCron: 'ok', rollbackAvailable: true,
    },
    {
      id: 'deploy_20260511_0915', clientId: 'cl_003', environment: 'prod',
      versionTag: 'initech/v14/2026.05.11-1', triggeredBy: 'dev2@enswork.com',
      triggerReason: 'Security patch CVE-2026-1234', status: 'failed',
      healthWeb: 'error', healthDb: 'ok', healthCron: 'unknown', rollbackAvailable: true,
    },
    {
      id: 'deploy_20260513_1000', clientId: 'cl_004', environment: 'staging',
      versionTag: 'umbrella/v19/2026.05.13-1', triggeredBy: 'dev3@enswork.com',
      triggerReason: 'Initial setup deployment', status: 'running',
      rollbackAvailable: false,
    },
  ]

  for (const dep of deployments) {
    await db.deployment.upsert({
      where: { id: dep.id },
      update: dep,
      create: dep,
    })
  }

  // Create alerts
  const alerts = [
    { id: 'alt_001', clientId: 'cl_003', level: 'critical', source: 'prometheus', message: 'DB connection pool exhausted - 5xx errors on /web', status: 'active' },
    { id: 'alt_002', clientId: 'cl_001', level: 'warning', source: 'loki', message: 'Memory usage > 85% on acmecorp container', status: 'active' },
    { id: 'alt_003', clientId: 'cl_006', level: 'warning', source: 'prometheus', message: 'Cron jobs failing on stark staging', status: 'active' },
    { id: 'alt_004', clientId: null, level: 'critical', source: 'system', message: 'Tailscale network latency > 200ms', status: 'active' },
  ]

  for (const alert of alerts) {
    await db.alert.upsert({
      where: { id: alert.id },
      update: alert,
      create: alert,
    })
  }

  // Create audit logs
  const auditLogs = [
    { user: 'admin@enswork.com', action: 'deploy', client: 'acmecorp', details: 'Deploy to prod - acmecorp/v17/2026.05.13-1', reason: 'Feature #142 validated by client' },
    { user: 'lead@enswork.com', action: 'deploy', client: 'globex', details: 'Deploy to staging - globex/v17/2026.05.12-1', reason: 'Integration module update' },
    { user: 'admin@enswork.com', action: 'ai_config', client: null, details: 'Changed model to claude-3.5-sonnet', reason: 'Better code generation quality' },
    { user: 'ops@enswork.com', action: 'acknowledge_alert', client: 'globex', details: 'Alert: Auto-backup completed', reason: 'Information only' },
  ]

  for (const log of auditLogs) {
    await db.auditLog.create({ data: log })
  }

  console.log('✅ Database seeded successfully!')
  console.log(`  - ${clients.length} clients`)
  console.log(`  - ${modules.length} modules`)
  console.log(`  - ${deployments.length} deployments`)
  console.log(`  - ${alerts.length} alerts`)
  console.log(`  - ${services.length} services`)
  console.log(`  - ${auditLogs.length} audit logs`)
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
