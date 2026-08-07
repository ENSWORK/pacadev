import { ClientData, ClientModule, Deployment, Backup, Alert, AIRisk, AISuggestion, Pipeline, AuditLog, ServiceHealth, AIConfig, UserSession, DashboardStats } from './types';

// ============ USER SESSION ============
export const mockUser: UserSession = {
  email: 'admin@enswork.com',
  name: 'Admin PACADEV',
  role: 'admin',
};

// ============ CLIENTS ============
export const mockClients: ClientData[] = [
  {
    id: 'cl_001', slug: 'acmecorp', name: 'ACME Corporation', odooVersion: '17',
    status: 'prod', stagingUrl: 'https://acmecorp-staging.enswork.local',
    prodUrl: 'https://acmecorp.enswork.local', tailscaleIp: '10.200.0.11',
    aclGroup: 'group:acmecorp', contacts: JSON.stringify({ dev: ['dev@enswork.com'], client: ['contact@acmecorp.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-13T14:30:00Z', createdAt: '2025-01-15T09:00:00Z', updatedAt: '2026-05-13T14:30:00Z',
  },
  {
    id: 'cl_002', slug: 'globex', name: 'Globex Industries', odooVersion: '17',
    status: 'staging', stagingUrl: 'https://globex-staging.enswork.local',
    prodUrl: 'https://globex.enswork.local', tailscaleIp: '10.200.0.12',
    aclGroup: 'group:globex', contacts: JSON.stringify({ dev: ['lead@enswork.com'], client: ['it@globex.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-12T18:45:00Z', createdAt: '2025-03-10T10:00:00Z', updatedAt: '2026-05-12T18:45:00Z',
  },
  {
    id: 'cl_003', slug: 'initech', name: 'Initech Solutions', odooVersion: '14',
    status: 'prod', stagingUrl: 'https://initech-staging.enswork.local',
    prodUrl: 'https://initech.enswork.local', tailscaleIp: '10.200.0.13',
    aclGroup: 'group:initech', contacts: JSON.stringify({ dev: ['dev2@enswork.com'], client: ['cto@initech.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-11T09:20:00Z', createdAt: '2024-11-20T08:00:00Z', updatedAt: '2026-05-11T09:20:00Z',
  },
  {
    id: 'cl_004', slug: 'umbrella', name: 'Umbrella Corp', odooVersion: '19',
    status: 'dev', stagingUrl: 'https://umbrella-staging.enswork.local',
    prodUrl: null, tailscaleIp: '10.200.0.14',
    aclGroup: 'group:umbrella', contacts: JSON.stringify({ dev: ['dev3@enswork.com'], client: ['admin@umbrella.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-13T10:00:00Z', createdAt: '2026-02-01T14:00:00Z', updatedAt: '2026-05-13T10:00:00Z',
  },
  {
    id: 'cl_005', slug: 'wayne', name: 'Wayne Enterprises', odooVersion: '17',
    status: 'prod', stagingUrl: 'https://wayne-staging.enswork.local',
    prodUrl: 'https://wayne.enswork.local', tailscaleIp: '10.200.0.15',
    aclGroup: 'group:wayne', contacts: JSON.stringify({ dev: ['dev@enswork.com'], client: ['bruce@wayne.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-13T16:00:00Z', createdAt: '2025-06-01T12:00:00Z', updatedAt: '2026-05-13T16:00:00Z',
  },
  {
    id: 'cl_006', slug: 'stark', name: 'Stark Industries', odooVersion: '17',
    status: 'staging', stagingUrl: 'https://stark-staging.enswork.local',
    prodUrl: 'https://stark.enswork.local', tailscaleIp: '10.200.0.16',
    aclGroup: 'group:stark', contacts: JSON.stringify({ dev: ['lead@enswork.com'], client: ['tony@stark.com'], ops: ['ops@enswork.com'] }),
    lastActivity: '2026-05-10T11:30:00Z', createdAt: '2025-09-15T09:00:00Z', updatedAt: '2026-05-10T11:30:00Z',
  },
];

// ============ MODULES ============
export const mockModules: Record<string, ClientModule[]> = {
  acmecorp: [
    { id: 'mod_001', clientId: 'cl_001', name: 'sale', version: '17.0.1.2', source: 'oca', status: 'installed', lastUpdated: '2026-05-10T08:00:00Z' },
    { id: 'mod_002', clientId: 'cl_001', name: 'purchase', version: '17.0.1.1', source: 'oca', status: 'installed', lastUpdated: '2026-05-08T14:00:00Z' },
    { id: 'mod_003', clientId: 'cl_001', name: 'acmecorp_custom', version: '1.3.0', source: 'custom', status: 'installed', lastUpdated: '2026-05-13T14:00:00Z' },
    { id: 'mod_004', clientId: 'cl_001', name: 'account', version: '17.0.2.0', source: 'oca', status: 'upgrade_available', lastUpdated: '2026-04-20T10:00:00Z' },
    { id: 'mod_005', clientId: 'cl_001', name: 'hr', version: '17.0.1.0', source: 'oca', status: 'disabled', lastUpdated: '2026-03-15T09:00:00Z' },
    { id: 'mod_006', clientId: 'cl_001', name: 'acmecorp_reports', version: '2.0.1', source: 'custom', status: 'installed', lastUpdated: '2026-05-12T16:00:00Z' },
  ],
  globex: [
    { id: 'mod_010', clientId: 'cl_002', name: 'sale', version: '17.0.1.2', source: 'oca', status: 'installed', lastUpdated: '2026-05-09T08:00:00Z' },
    { id: 'mod_011', clientId: 'cl_002', name: 'globex_integration', version: '3.1.0', source: 'custom', status: 'installed', lastUpdated: '2026-05-12T18:00:00Z' },
    { id: 'mod_012', clientId: 'cl_002', name: 'stock', version: '17.0.1.0', source: 'oca', status: 'installed', lastUpdated: '2026-05-01T12:00:00Z' },
  ],
  initech: [
    { id: 'mod_020', clientId: 'cl_003', name: 'sale', version: '14.0.3.2', source: 'oca', status: 'installed', lastUpdated: '2026-04-15T10:00:00Z' },
    { id: 'mod_021', clientId: 'cl_003', name: 'initech_portal', version: '1.0.5', source: 'custom', status: 'installed', lastUpdated: '2026-05-11T08:00:00Z' },
  ],
};

// ============ DEPLOYMENTS ============
export const mockDeployments: Deployment[] = [
  {
    id: 'deploy_20260513_1430', clientId: 'cl_001', environment: 'prod', versionTag: 'acmecorp/v17/2026.05.13-1',
    triggeredBy: 'admin@enswork.com', triggerReason: 'Feature #142 validated by client',
    status: 'success', startedAt: '2026-05-13T14:30:00Z', completedAt: '2026-05-13T14:35:00Z',
    backupId: 'bk-20260513-1430', healthWeb: 'ok', healthDb: 'ok', healthCron: 'ok', rollbackAvailable: true,
  },
  {
    id: 'deploy_20260512_1800', clientId: 'cl_002', environment: 'staging', versionTag: 'globex/v17/2026.05.12-1',
    triggeredBy: 'lead@enswork.com', triggerReason: 'Integration module update',
    status: 'success', startedAt: '2026-05-12T18:00:00Z', completedAt: '2026-05-12T18:08:00Z',
    backupId: 'bk-20260512-1800', healthWeb: 'ok', healthDb: 'ok', healthCron: 'ok', rollbackAvailable: true,
  },
  {
    id: 'deploy_20260511_0915', clientId: 'cl_003', environment: 'prod', versionTag: 'initech/v14/2026.05.11-1',
    triggeredBy: 'dev2@enswork.com', triggerReason: 'Security patch CVE-2026-1234',
    status: 'failed', startedAt: '2026-05-11T09:15:00Z', completedAt: '2026-05-11T09:22:00Z',
    backupId: 'bk-20260511-0915', healthWeb: 'error', healthDb: 'ok', healthCron: 'unknown', rollbackAvailable: true,
  },
  {
    id: 'deploy_20260513_1000', clientId: 'cl_004', environment: 'staging', versionTag: 'umbrella/v19/2026.05.13-1',
    triggeredBy: 'dev3@enswork.com', triggerReason: 'Initial setup deployment',
    status: 'running', startedAt: '2026-05-13T10:00:00Z', completedAt: null,
    backupId: null, healthWeb: null, healthDb: null, healthCron: null, rollbackAvailable: false,
  },
  {
    id: 'deploy_20260513_1555', clientId: 'cl_005', environment: 'prod', versionTag: 'wayne/v17/2026.05.13-1',
    triggeredBy: 'admin@enswork.com', triggerReason: 'Reports module v2.0.1',
    status: 'success', startedAt: '2026-05-13T15:55:00Z', completedAt: '2026-05-13T16:00:00Z',
    backupId: 'bk-20260513-1555', healthWeb: 'ok', healthDb: 'ok', healthCron: 'ok', rollbackAvailable: true,
  },
  {
    id: 'deploy_20260510_1130', clientId: 'cl_006', environment: 'staging', versionTag: 'stark/v17/2026.05.10-1',
    triggeredBy: 'lead@enswork.com', triggerReason: 'Monthly maintenance',
    status: 'rolled_back', startedAt: '2026-05-10T11:30:00Z', completedAt: '2026-05-10T11:45:00Z',
    backupId: 'bk-20260510-1130', healthWeb: 'error', healthDb: 'ok', healthCron: 'error', rollbackAvailable: false,
  },
];

// ============ BACKUPS ============
export const mockBackups: Record<string, Backup[]> = {
  acmecorp: [
    { id: 'bk-20260513-1430', clientId: 'cl_001', timestamp: '2026-05-13T14:30:00Z', size: 524288000, checksum: 'sha256:abc123', status: 'completed', uploadOk: true, retention: '30d', type: 'full' },
    { id: 'bk-20260512-0200', clientId: 'cl_001', timestamp: '2026-05-12T02:00:00Z', size: 522000000, checksum: 'sha256:def456', status: 'completed', uploadOk: true, retention: '30d', type: 'full' },
    { id: 'bk-20260511-0200', clientId: 'cl_001', timestamp: '2026-05-11T02:00:00Z', size: 521000000, checksum: 'sha256:ghi789', status: 'completed', uploadOk: true, retention: '30d', type: 'db_only' },
  ],
  globex: [
    { id: 'bk-20260512-1800', clientId: 'cl_002', timestamp: '2026-05-12T18:00:00Z', size: 312000000, checksum: 'sha256:jkl012', status: 'completed', uploadOk: true, retention: '30d', type: 'full' },
  ],
  initech: [
    { id: 'bk-20260511-0915', clientId: 'cl_003', timestamp: '2026-05-11T09:15:00Z', size: 890000000, checksum: 'sha256:mno345', status: 'completed', uploadOk: true, retention: '90d', type: 'full' },
  ],
};

// ============ ALERTS ============
export const mockAlerts: Alert[] = [
  { id: 'alt_001', clientId: 'cl_003', level: 'critical', source: 'prometheus', message: 'DB connection pool exhausted - 5xx errors on /web', status: 'active', acknowledgedBy: null, createdAt: '2026-05-13T14:00:00Z' },
  { id: 'alt_002', clientId: 'cl_001', level: 'warning', source: 'loki', message: 'Memory usage > 85% on acmecorp container', status: 'active', acknowledgedBy: null, createdAt: '2026-05-13T13:30:00Z' },
  { id: 'alt_003', clientId: 'cl_006', level: 'warning', source: 'prometheus', message: 'Cron jobs failing on stark staging', status: 'active', acknowledgedBy: null, createdAt: '2026-05-13T12:00:00Z' },
  { id: 'alt_004', clientId: null, level: 'critical', source: 'system', message: 'Tailscale network latency > 200ms', status: 'active', acknowledgedBy: null, createdAt: '2026-05-13T11:00:00Z' },
  { id: 'alt_005', clientId: 'cl_002', level: 'info', source: 'system', message: 'Auto-backup completed successfully', status: 'acknowledged', acknowledgedBy: 'ops@enswork.com', createdAt: '2026-05-13T06:00:00Z' },
];

// ============ AI RISKS ============
export const mockAIRisks: Record<string, AIRisk> = {
  acmecorp: {
    id: 'risk_001', clientId: 'cl_001', commitHash: 'abc123def456', score: 0.2,
    schemaChanges: 0, securityPatterns: 0, depChanges: 1, bizLogicChanges: 2,
    recommendation: 'auto_merge', explanation: 'Changements mineurs, pas d\'impact schema, dépendance OCA mise à jour testée',
    requiresReview: false,
  },
  globex: {
    id: 'risk_002', clientId: 'cl_002', commitHash: '789ghi012jkl', score: 0.55,
    schemaChanges: 2, securityPatterns: 0, depChanges: 3, bizLogicChanges: 5,
    recommendation: 'review_required', explanation: 'Modifications schema détectées (2 champs), changements logique métier importants',
    requiresReview: true,
  },
  initech: {
    id: 'risk_003', clientId: 'cl_003', commitHash: 'mno345pqr678', score: 0.85,
    schemaChanges: 5, securityPatterns: 2, depChanges: 4, bizLogicChanges: 8,
    recommendation: 'manual_only', explanation: 'Risque élevé: changements schema + patterns sécurité détectés. Review manuelle obligatoire.',
    requiresReview: true,
  },
};

// ============ AI SUGGESTIONS ============
export const mockSuggestions: AISuggestion[] = [
  {
    id: 'sug_001', clientId: 'cl_001', type: 'fix_lint', title: 'Corriger erreurs lint module acmecorp_custom',
    description: '12 erreurs lint détectées dans les contrôleurs et vues du module custom', codeDiff: '@@ -45,3 +45,3 @@\n-    result = self.env[\'sale.order\'].search([])\n+    result = self.env[\'sale.order\'].search(domain)',
    impact: 'Faible - Correction syntaxique uniquement', status: 'pending', appliedBy: null, appliedAt: null,
  },
  {
    id: 'sug_002', clientId: 'cl_001', type: 'missing_test', title: 'Ajouter tests unitaires pour acmecorp_reports',
    description: 'Couverture de tests à 23% pour le module reports. Minimum recommandé: 80%', codeDiff: null,
    impact: 'Moyen - Amélioration qualité sans impact fonctionnel', status: 'pending', appliedBy: null, appliedAt: null,
  },
  {
    id: 'sug_003', clientId: 'cl_002', type: 'migration', title: 'Migration champ partner_id → res.partner',
    description: 'Le champ partner_id utilise encore l\'ancien modèle. Migration vers res.partner recommandée.', codeDiff: '@@ -12,3 +12,3 @@\n-    partner_id = fields.Many2one(\'res.partner\', oldname=\'partner_id\')\n+    partner_id = fields.Many2one(\'res.partner\')',
    impact: 'Élevé - Changement de schéma, nécessite migration DB', status: 'pending', appliedBy: null, appliedAt: null,
  },
  {
    id: 'sug_004', clientId: 'cl_003', type: 'security', title: 'Vulnérabilité XSS dans le portail Initech',
    description: 'Injection HTML possible dans le formulaire de contact du portail client', codeDiff: '@@ -78,3 +78,3 @@\n-    return markup(message)\n+    return escape(message)',
    impact: 'Critique - Faille de sécurité XSS', status: 'pending', appliedBy: null, appliedAt: null,
  },
  {
    id: 'sug_005', clientId: 'cl_001', type: 'refactor', title: 'Refactor méthode _compute_amount',
    description: 'La méthode _compute_amount est trop complexe (cyclomatic = 15). Découpage recommandé.', codeDiff: null,
    impact: 'Faible - Amélioration maintenabilité', status: 'ignored', appliedBy: null, appliedAt: null,
  },
];

// ============ PIPELINES ============
export const mockPipelines: Pipeline[] = [
  {
    id: 'pipe_001', clientId: 'cl_001', commitHash: 'abc123', branch: 'main', trigger: 'push',
    status: 'success', lintStatus: 'success', testsStatus: 'success', securityStatus: 'success',
    aiRiskStatus: 'success', deployStatus: 'success', duration: 245, logs: null,
  },
  {
    id: 'pipe_002', clientId: 'cl_002', commitHash: '789ghi', branch: 'dev/integration', trigger: 'push',
    status: 'running', lintStatus: 'success', testsStatus: 'running', securityStatus: 'pending',
    aiRiskStatus: 'pending', deployStatus: 'pending', duration: null, logs: null,
  },
  {
    id: 'pipe_003', clientId: 'cl_003', commitHash: 'mno345', branch: 'main', trigger: 'manual',
    status: 'failed', lintStatus: 'success', testsStatus: 'success', securityStatus: 'failed',
    aiRiskStatus: 'skipped', deployStatus: 'skipped', duration: 180, logs: null,
  },
  {
    id: 'pipe_004', clientId: 'cl_004', commitHash: 'stu901', branch: 'dev/setup', trigger: 'push',
    status: 'running', lintStatus: 'running', testsStatus: 'pending', securityStatus: 'pending',
    aiRiskStatus: 'pending', deployStatus: 'pending', duration: null, logs: null,
  },
];

// ============ AUDIT LOGS ============
export const mockAuditLogs: AuditLog[] = [
  { id: 'aud_001', user: 'admin@enswork.com', action: 'deploy', client: 'acmecorp', details: 'Deploy to prod - acmecorp/v17/2026.05.13-1', reason: 'Feature #142 validated by client', createdAt: '2026-05-13T14:30:00Z' },
  { id: 'aud_002', user: 'lead@enswork.com', action: 'deploy', client: 'globex', details: 'Deploy to staging - globex/v17/2026.05.12-1', reason: 'Integration module update', createdAt: '2026-05-12T18:00:00Z' },
  { id: 'aud_003', user: 'dev2@enswork.com', action: 'deploy', client: 'initech', details: 'Deploy to prod - FAILED', reason: 'Security patch CVE-2026-1234', createdAt: '2026-05-11T09:15:00Z' },
  { id: 'aud_004', user: 'admin@enswork.com', action: 'rollback', client: 'stark', details: 'Rollback to stark/v17/2026.05.09-2', reason: 'Cron jobs failing after deploy', createdAt: '2026-05-10T11:40:00Z' },
  { id: 'aud_005', user: 'ops@enswork.com', action: 'acknowledge_alert', client: 'globex', details: 'Alert: Auto-backup completed', reason: 'Information only', createdAt: '2026-05-13T07:00:00Z' },
  { id: 'aud_006', user: 'admin@enswork.com', action: 'ai_config', client: null, details: 'Changed model to claude-3.5-sonnet', reason: 'Better code generation quality', createdAt: '2026-05-12T10:00:00Z' },
  { id: 'aud_007', user: 'dev3@enswork.com', action: 'backup', client: 'umbrella', details: 'Manual backup triggered', reason: 'Pre-deployment safety', createdAt: '2026-05-13T09:45:00Z' },
  { id: 'aud_008', user: 'lead@enswork.com', action: 'approve', client: 'wayne', details: 'Approved staging validation', reason: 'Client confirmed OK', createdAt: '2026-05-13T15:00:00Z' },
];

// ============ SERVICE HEALTH ============
export const mockServices: ServiceHealth[] = [
  { id: 'svc_001', name: 'Docker Engine', type: 'docker', status: 'up', url: 'unix:///var/run/docker.sock', lastCheck: '2026-05-13T16:00:00Z' },
  { id: 'svc_002', name: 'Traefik Proxy', type: 'traefik', status: 'up', url: 'http://traefik:8080', lastCheck: '2026-05-13T16:00:00Z' },
  { id: 'svc_003', name: 'Tailscale Network', type: 'tailscale', status: 'degraded', url: 'http://tailscale:9002', lastCheck: '2026-05-13T16:00:00Z' },
  { id: 'svc_004', name: 'PostgreSQL Primary', type: 'db', status: 'up', url: 'postgresql://db:5432', lastCheck: '2026-05-13T16:00:00Z' },
  { id: 'svc_005', name: 'PostgreSQL Replica', type: 'db', status: 'up', url: 'postgresql://db-replica:5432', lastCheck: '2026-05-13T16:00:00Z' },
  { id: 'svc_006', name: 'Redis Cache', type: 'docker', status: 'up', url: 'redis://redis:6379', lastCheck: '2026-05-13T16:00:00Z' },
];

// ============ AI CONFIG ============
export const mockAIConfig: AIConfig = {
  id: 'cfg_001', model: 'claude-3.5-sonnet', maxTokens: 4000, fallbackModel: 'gpt-4o',
  costThreshold: 50.0, autoMerge: false, autoDeploy: false, autoRollback: false,
};

// ============ DASHBOARD STATS ============
export const mockDashboardStats: DashboardStats = {
  totalClients: 6,
  activeDeployments: 1,
  criticalAlerts: 2,
  iaTokensUsed: 245000,
  iaCostEstimated: 34.50,
  servicesUp: 5,
  servicesTotal: 6,
};

// ============ BRANCHES (not in DB, from GitHub API mock) ============
export interface GitBranch {
  name: string;
  author: string;
  date: string;
  status: 'ahead' | 'behind' | 'synced' | 'diverged';
  ciStatus: 'success' | 'failed' | 'running' | 'pending';
  isProtected: boolean;
}

export const mockBranches: Record<string, GitBranch[]> = {
  acmecorp: [
    { name: 'main', author: 'admin', date: '2026-05-13T14:30:00Z', status: 'synced', ciStatus: 'success', isProtected: true },
    { name: 'dev/feature-142', author: 'dev@enswork.com', date: '2026-05-13T12:00:00Z', status: 'ahead', ciStatus: 'success', isProtected: false },
    { name: 'dev/fix-lint', author: 'dev@enswork.com', date: '2026-05-12T16:00:00Z', status: 'ahead', ciStatus: 'running', isProtected: false },
    { name: 'staging', author: 'lead@enswork.com', date: '2026-05-13T14:00:00Z', status: 'synced', ciStatus: 'success', isProtected: true },
  ],
  globex: [
    { name: 'main', author: 'admin', date: '2026-05-12T18:00:00Z', status: 'synced', ciStatus: 'success', isProtected: true },
    { name: 'dev/integration', author: 'lead@enswork.com', date: '2026-05-12T17:00:00Z', status: 'ahead', ciStatus: 'running', isProtected: false },
  ],
};

// ============ TICKETS (not in DB, from GitHub Issues mock) ============
export interface Ticket {
  id: number;
  title: string;
  status: 'open' | 'closed' | 'in_progress';
  assignee: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export const mockTickets: Record<string, Ticket[]> = {
  acmecorp: [
    { id: 142, title: 'Feature: Export PDF des rapports', status: 'closed', assignee: 'dev@enswork.com', labels: ['feature', 'v17'], createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-13T14:00:00Z' },
    { id: 143, title: 'Bug: Erreur 500 sur page contact', status: 'in_progress', assignee: 'dev@enswork.com', labels: ['bug', 'critical'], createdAt: '2026-05-12T09:00:00Z', updatedAt: '2026-05-13T11:00:00Z' },
    { id: 144, title: 'Amélioration performance liste commandes', status: 'open', assignee: null, labels: ['performance'], createdAt: '2026-05-13T08:00:00Z', updatedAt: '2026-05-13T08:00:00Z' },
  ],
  globex: [
    { id: 56, title: 'Integration API ERP - Phase 2', status: 'in_progress', assignee: 'lead@enswork.com', labels: ['feature', 'integration'], createdAt: '2026-05-05T14:00:00Z', updatedAt: '2026-05-12T16:00:00Z' },
  ],
};

// ============ SMOKE TEST RESULTS ============
export interface SmokeTest {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'running';
  duration: number;
  lastRun: string;
  screenshot?: string;
}

export const mockSmokeTests: SmokeTest[] = [
  { id: 'st_001', name: 'Login page loads', status: 'passed', duration: 2300, lastRun: '2026-05-13T15:00:00Z' },
  { id: 'st_002', name: 'Sale order creation', status: 'passed', duration: 4500, lastRun: '2026-05-13T15:00:00Z' },
  { id: 'st_003', name: 'Report PDF generation', status: 'failed', duration: 8200, lastRun: '2026-05-13T15:00:00Z' },
  { id: 'st_004', name: 'Portal access', status: 'passed', duration: 1800, lastRun: '2026-05-13T15:00:00Z' },
  { id: 'st_005', name: 'API health check', status: 'passed', duration: 500, lastRun: '2026-05-13T15:00:00Z' },
];

// ============ LOG ENTRIES ============
export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  service: string;
  message: string;
  client?: string;
  module?: string;
}

export const mockLogEntries: LogEntry[] = [
  { timestamp: '2026-05-13T16:05:12.123Z', level: 'INFO', service: 'odoo', message: 'Worker process started', client: 'acmecorp' },
  { timestamp: '2026-05-13T16:05:10.456Z', level: 'WARNING', service: 'odoo', message: 'Memory usage at 87%', client: 'acmecorp' },
  { timestamp: '2026-05-13T16:05:08.789Z', level: 'ERROR', service: 'db', message: 'Connection pool exhausted, retrying...', client: 'initech' },
  { timestamp: '2026-05-13T16:05:05.012Z', level: 'INFO', service: 'traefik', message: 'Route acmecorp.enswork.local → backend healthy' },
  { timestamp: '2026-05-13T16:04:58.345Z', level: 'INFO', service: 'odoo', message: 'Cron job mail.fetch completed', client: 'globex' },
  { timestamp: '2026-05-13T16:04:55.678Z', level: 'ERROR', service: 'odoo', message: '500 Internal Server Error on /web/login', client: 'initech', module: 'web' },
  { timestamp: '2026-05-13T16:04:50.901Z', level: 'DEBUG', service: 'odoo', message: 'Cache miss for ir.ui.view#1234', client: 'wayne' },
  { timestamp: '2026-05-13T16:04:45.234Z', level: 'INFO', service: 'tailscale', message: 'Network latency: 220ms (threshold: 200ms)' },
  { timestamp: '2026-05-13T16:04:40.567Z', level: 'WARNING', service: 'odoo', message: 'Long running query (3.2s): sale_order_search', client: 'stark' },
  { timestamp: '2026-05-13T16:04:35.890Z', level: 'INFO', service: 'docker', message: 'Container acmecorp-web health check: OK' },
];

// ============ SESSION INFO ============
import type { BackupSecurityInfo, SecurityScanResult } from './types';

export const mockSessionInfo: UserSession & { expiresAt: string; startedAt: string; ip: string; mfaEnabled: boolean } = {
  email: 'admin@enswork.com',
  name: 'Admin PACADEV',
  role: 'admin',
  startedAt: new Date(Date.now() - 3600_000).toISOString(),
  expiresAt: new Date(Date.now() + 7200_000).toISOString(),
  ip: '192.168.11.117',
  mfaEnabled: true,
};

// ============ BACKUP SECURITY INFO ============
export const mockBackupSecurityInfo: BackupSecurityInfo = {
  encryptionEnabled: true,
  encryptionKeyId: 'age1xyz-pacadev-prod-key',
  lastKeyRotation: '2026-03-01T00:00:00Z',
  nextKeyRotation: '2026-09-01T00:00:00Z',
  lastIntegrityCheck: '2026-05-13T02:00:00Z',
  integrityCheckOk: true,
  retentionDays: 30,
  encryptedBackupsPercent: 100,
  lastRestoreTest: '2026-05-01T10:00:00Z',
  restoreTestOk: true,
};

// ============ SECURITY SCAN RESULTS ============
export const mockSecurityScanResults: Record<string, SecurityScanResult> = {
  acmecorp: { secretsScanOk: true, secretsCount: 0, commitSignaturesVerified: true, riskScore: 0.2, lastScanAt: '2026-05-13T14:00:00Z' },
  globex: { secretsScanOk: true, secretsCount: 0, commitSignaturesVerified: true, riskScore: 0.55, lastScanAt: '2026-05-12T18:00:00Z' },
  initech: { secretsScanOk: false, secretsCount: 2, commitSignaturesVerified: false, riskScore: 0.85, lastScanAt: '2026-05-11T09:00:00Z' },
  umbrella: { secretsScanOk: true, secretsCount: 0, commitSignaturesVerified: true, riskScore: 0.3, lastScanAt: '2026-05-13T10:00:00Z' },
  wayne: { secretsScanOk: true, secretsCount: 0, commitSignaturesVerified: true, riskScore: 0.15, lastScanAt: '2026-05-13T15:00:00Z' },
  stark: { secretsScanOk: true, secretsCount: 0, commitSignaturesVerified: true, riskScore: 0.4, lastScanAt: '2026-05-10T11:00:00Z' },
};

// ============ WORKSPACE TICKETS (extended, multi-client) ============
export interface WorkspaceTicket {
  id: number;
  title: string;
  client: string;
  type: 'feature' | 'bug' | 'hotfix' | 'refacto';
  status: 'open' | 'in_progress' | 'review' | 'staging' | 'prod' | 'closed';
  assignee: string | null;
  labels: string[];
  branch: string | null;
  createdAt: string;
  updatedAt: string;
}

export const mockWorkspaceTickets: WorkspaceTicket[] = [
  { id: 143, title: 'Bug: Erreur 500 sur page contact', client: 'acmecorp', type: 'bug', status: 'in_progress', assignee: 'dev@enswork.com', labels: ['bug', 'critical'], branch: 'dev/afrequip/143-fix-500', createdAt: '2026-05-12T09:00:00Z', updatedAt: '2026-05-13T11:00:00Z' },
  { id: 56, title: 'Integration API ERP - Phase 2', client: 'globex', type: 'feature', status: 'review', assignee: 'lead@enswork.com', labels: ['feature', 'integration'], branch: 'dev/globex/56-erp-phase2', createdAt: '2026-05-05T14:00:00Z', updatedAt: '2026-05-12T16:00:00Z' },
  { id: 144, title: 'Amélioration performance liste commandes', client: 'acmecorp', type: 'refacto', status: 'open', assignee: null, labels: ['performance'], branch: null, createdAt: '2026-05-13T08:00:00Z', updatedAt: '2026-05-13T08:00:00Z' },
  { id: 21, title: 'Hotfix: Tailscale ACL initech', client: 'initech', type: 'hotfix', status: 'staging', assignee: 'dev2@enswork.com', labels: ['hotfix', 'security'], branch: 'dev/initech/21-tailscale-acl', createdAt: '2026-05-11T07:00:00Z', updatedAt: '2026-05-13T09:00:00Z' },
  { id: 142, title: 'Feature: Export PDF des rapports', client: 'acmecorp', type: 'feature', status: 'closed', assignee: 'dev@enswork.com', labels: ['feature', 'v17'], branch: 'dev/acmecorp/142-pdf-export', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-13T14:00:00Z' },
];

// ============ WORKFLOW STEPS ============
export interface WorkflowStepItem {
  number: number;
  label: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  responsible?: string;
  since?: string;
  details?: string;
}

export const mockWorkflowSteps: Record<string, WorkflowStepItem[]> = {
  '143': [
    { number: 1, label: 'Ticket créé', status: 'completed', responsible: 'dev@enswork.com', since: '2026-05-12T09:00:00Z' },
    { number: 2, label: 'Développement', status: 'in_progress', responsible: 'dev@enswork.com', since: '2026-05-12T10:00:00Z', details: 'Branche dev/afrequip/143-fix-500' },
    { number: 3, label: 'CI/CD Pipeline', status: 'pending' },
    { number: 4, label: 'Validation Staging', status: 'pending' },
    { number: 5, label: 'Validation Client', status: 'pending' },
    { number: 6, label: 'Déploiement Prod', status: 'pending' },
  ],
  '56': [
    { number: 1, label: 'Ticket créé', status: 'completed', responsible: 'lead@enswork.com', since: '2026-05-05T14:00:00Z' },
    { number: 2, label: 'Développement', status: 'completed', responsible: 'lead@enswork.com', since: '2026-05-05T15:00:00Z' },
    { number: 3, label: 'CI/CD Pipeline', status: 'completed', responsible: 'system', since: '2026-05-12T17:00:00Z' },
    { number: 4, label: 'Validation Staging', status: 'in_progress', responsible: 'lead@enswork.com', since: '2026-05-12T18:00:00Z' },
    { number: 5, label: 'Validation Client', status: 'pending' },
    { number: 6, label: 'Déploiement Prod', status: 'pending' },
  ],
};
