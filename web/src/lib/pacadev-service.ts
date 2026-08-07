import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { spawnSync } from 'child_process';
import type {
  ClientData,
  AuditLog,
  AIConfig,
  UserRole,
  DashboardStats,
  Pipeline,
  Deployment,
  Backup,
  Alert,
} from './types';

const PACADEV_HOME = process.env.PACADEV_HOME || path.join('/home/pacadev', '.pacadev');
const PACADEV_WORKSPACE = process.env.PACADEV_WORKSPACE || '/home/pacadev/pacadev';
const DOCKER_BIN = process.env.DOCKER_BIN || '/usr/bin/docker';

// ============ TYPES ============
interface VersionsJSON {
  clients: Record<string, {
    odoo_version: string;
    status: string;
    path?: string;
    target_path?: string;
    source_path?: string;
    created_at?: string;
    current_branch?: string;
    current_issue?: string | null;
    current_repo?: string;
    migrated_from?: string;
    migration_date?: string;
  }>;
  last_sync: string;
  pacadev_version: string;
}

interface ConfigYAML {
  defaults: {
    odoo_version: string;
    branch_prefix: string;
    ai: {
      max_tokens: number;
      risk_threshold: number;
      fallback_model: string;
    };
  };
  paths: {
    workspace: string;
    state_dir: string;
  };
  github: {
    org: string;
    core_repo: string;
  };
}

interface RBACJson {
  roles: Record<string, { permissions: string[] }>;
  users?: Record<string, { role: string }>;
}

// ============ FILE READERS ============
export function readVersionsJSON(): VersionsJSON {
  const file = path.join(PACADEV_HOME, 'state', 'versions.json');
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read versions.json: ${err}`);
    return { clients: {}, last_sync: new Date().toISOString(), pacadev_version: '1.0.0' };
  }
}

export function readConfigYAML(): ConfigYAML {
  const file = path.join(PACADEV_HOME, 'config.yaml');
  try {
    // Simple YAML parser for our specific structure
    const data = fs.readFileSync(file, 'utf-8');
    const config: ConfigYAML = {
      defaults: {
        odoo_version: '17',
        branch_prefix: 'dev/',
        ai: { max_tokens: 4000, risk_threshold: 0.5, fallback_model: 'gpt-4o' },
      },
      paths: { workspace: PACADEV_WORKSPACE, state_dir: '~/.pacadev/state' },
      github: { org: 'ENSWORK', core_repo: 'ENSWORK/pacadev' },
    };
    // Parse values from YAML
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.includes('max_tokens:')) {
        const val = parseInt(line.split(':')[1].trim());
        if (!isNaN(val)) config.defaults.ai.max_tokens = val;
      }
      if (line.includes('risk_threshold:')) {
        const val = parseFloat(line.split(':')[1].trim());
        if (!isNaN(val)) config.defaults.ai.risk_threshold = val;
      }
    }
    return config;
  } catch (err) {
    console.error(`Failed to read config.yaml: ${err}`);
    return {
      defaults: {
        odoo_version: '17',
        branch_prefix: 'dev/',
        ai: { max_tokens: 4000, risk_threshold: 0.5, fallback_model: 'gpt-4o' },
      },
      paths: { workspace: PACADEV_WORKSPACE, state_dir: '~/.pacadev/state' },
      github: { org: 'ENSWORK', core_repo: 'ENSWORK/pacadev' },
    };
  }
}

export function readRBACJSON(): RBACJson {
  const file = path.join(PACADEV_HOME, 'rbac.json');
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read rbac.json: ${err}`);
    return { roles: {} };
  }
}

export function readAuditLog(): AuditLog[] {
  const file = path.join(PACADEV_HOME, 'state', 'audit-log.jsonl');
  try {
    const data = fs.readFileSync(file, 'utf-8');
    const lines = data.trim().split('\n');
    return lines
      .map((line): AuditLog | null => {
        try {
          const parsed = JSON.parse(line);
          return {
            id: parsed.hash || `audit_${Math.random().toString(36).substr(2, 9)}`,
            user: parsed.user || 'system',
            action: parsed.action || 'unknown',
            client: parsed.client && parsed.client !== '_global' ? parsed.client : null,
            details: parsed.action === 'work_start' ? `Branch: ${parsed.branch}` : (JSON.stringify(parsed) ?? null),
            reason: parsed.phase || parsed.summary?.reason || null,
            createdAt: parsed.timestamp || new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
      .filter((l): l is AuditLog => l !== null)
      .reverse();
  } catch (err) {
    console.error(`Failed to read audit-log.jsonl: ${err}`);
    return [];
  }
}

// ============ AI CONFIG (persisté sur disque) ============
const DEFAULT_AI_CONFIG: AIConfig = {
  id: 'cfg_001',
  model: 'claude-3.5-sonnet',
  maxTokens: 4000,
  fallbackModel: 'gpt-4o',
  costThreshold: 50.0,
  autoMerge: false,
  autoDeploy: false,
  autoRollback: false,
};

export function readAIConfig(): AIConfig {
  const file = path.join(PACADEV_HOME, 'state', 'ai-config.json');
  try {
    return { ...DEFAULT_AI_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf-8')) };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function writeAIConfig(patch: Record<string, unknown>): AIConfig {
  const current = readAIConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(path.join(PACADEV_HOME, 'state', 'ai-config.json'), JSON.stringify(next, null, 2));
  return next;
}

// ============ CLIENT MAPPING ============
export function mapClientToData(slug: string, clientData: VersionsJSON['clients'][string], index: number): ClientData {
  const versionStr = clientData.odoo_version;

  return {
    id: `cl_${slug}`,
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' '),
    odooVersion: versionStr,
    status: (clientData.status || 'dev') as 'dev' | 'staging' | 'prod',
    stagingUrl: `http://localhost:${8000 + index}`,
    prodUrl: null,
    tailscaleIp: null,
    aclGroup: null,
    contacts: null,
    lastActivity: clientData.created_at || new Date().toISOString(),
    createdAt: clientData.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getClientsFromPACAPDEV(): ClientData[] {
  const versions = readVersionsJSON();
  const slugs = Object.keys(versions.clients);

  return slugs.map((slug, index) => mapClientToData(slug, versions.clients[slug], index));
}

export function getClientFromPACAPDEV(slug: string): ClientData | null {
  const versions = readVersionsJSON();
  const clientData = versions.clients[slug];

  if (!clientData) return null;

  const index = Object.keys(versions.clients).indexOf(slug);
  return mapClientToData(slug, clientData, index);
}

// ============ DASHBOARD STATS ============
export function getDashboardStats(): DashboardStats {
  const clients = getClientsFromPACAPDEV();
  const auditLog = readAuditLog();
  const recentDeploys = auditLog.filter((a) => a.action === 'deploy').slice(0, 5);

  return {
    totalClients: clients.length,
    activeDeployments: recentDeploys.filter((d) => {
      const createdAt = new Date(d.createdAt).getTime();
      return Date.now() - createdAt < 3600_000; // Last hour
    }).length,
    criticalAlerts: 0,
    iaTokensUsed: 0,
    iaCostEstimated: 0,
    servicesUp: 6,
    servicesTotal: 6,
  };
}

// ============ DEBUG ============
export function getPacadevPaths() {
  return {
    home: PACADEV_HOME,
    workspace: PACADEV_WORKSPACE,
    versionsFile: path.join(PACADEV_HOME, 'state', 'versions.json'),
    auditFile: path.join(PACADEV_HOME, 'state', 'audit-log.jsonl'),
    configFile: path.join(PACADEV_HOME, 'config.yaml'),
    rbacFile: path.join(PACADEV_HOME, 'rbac.json'),
  };
}

// ============ HELPER: resolve client addon path ============
function getAddonPath(slug: string): string | null {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  if (!client) return null;
  const ver = client.odoo_version;
  return path.join(PACADEV_WORKSPACE, `v${ver}`, 'clients', slug, 'addons');
}

// ============ MODULES ============
interface OdooModule {
  name: string;
  technicalName: string;
  version: string;
  category: string;
  author: string;
  source: 'ens_core' | 'oca' | 'custom';
  path: string;
  installed: boolean;
}

function parseManifest(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    name: /'name'\s*:\s*'([^']+)'/,
    version: /'version'\s*:\s*'([^']+)'/,
    category: /'category'\s*:\s*'([^']+)'/,
    author: /'author'\s*:\s*'([^']+)'/,
    summary: /'summary'\s*:\s*'([^']+)'/,
  };
  for (const [key, re] of Object.entries(patterns)) {
    const m = content.match(re);
    if (m) result[key] = m[1];
  }
  return result;
}

export function getClientModules(slug: string): OdooModule[] {
  const addonBase = getAddonPath(slug);
  if (!addonBase) return [];

  const modules: OdooModule[] = [];
  const sources: Array<'ens_core' | 'oca'> = ['ens_core', 'oca'];

  for (const source of sources) {
    const sourceDir = path.join(addonBase, source);
    if (!fs.existsSync(sourceDir)) continue;
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(sourceDir, entry.name, '__manifest__.py');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const meta = parseManifest(content);
        modules.push({
          name: meta.name || entry.name,
          technicalName: entry.name,
          version: meta.version || '1.0',
          category: meta.category || 'Uncategorized',
          author: meta.author || 'Unknown',
          source,
          path: path.join(sourceDir, entry.name),
          installed: true,
        });
      } catch {
        // skip unreadable manifest
      }
    }
  }

  return modules;
}

// ============ DOCKER STATUS ============
interface DockerStatus {
  running: boolean;
  containerName: string;
  status: string;
  port: string | null;
  health: string;
}

export function getDockerStatus(slug: string): DockerStatus {
  const containerName = `${slug}_odoo`;
  try {
    const output = execSync(
      `${DOCKER_BIN} ps --filter "name=${containerName}" --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"`,
      { timeout: 5000, encoding: 'utf-8' }
    ).trim();

    if (!output) {
      return { running: false, containerName, status: 'stopped', port: null, health: 'down' };
    }

    const [, status, ports] = output.split('\t');
    const portMatch = ports?.match(/0\.0\.0\.0:(\d+)->/);
    return {
      running: true,
      containerName,
      status,
      port: portMatch ? portMatch[1] : null,
      health: status?.includes('healthy') ? 'healthy' : status?.includes('Up') ? 'running' : 'degraded',
    };
  } catch {
    return { running: false, containerName, status: 'error', port: null, health: 'unknown' };
  }
}

// ============ DOCKER METRICS ============
interface DockerMetrics {
  cpu: number;
  memUsed: string;
  memTotal: string;
  memPercent: number;
  available: boolean;
}

export function getDockerMetrics(slug: string): DockerMetrics {
  const containerName = `${slug}_odoo`;
  try {
    const output = execSync(
      `${DOCKER_BIN} stats --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" ${containerName}`,
      { timeout: 8000, encoding: 'utf-8' }
    ).trim();

    if (!output) return { cpu: 0, memUsed: '0B', memTotal: '0B', memPercent: 0, available: false };

    const [cpuStr, memUsage, memPercStr] = output.split('\t');
    const [memUsed, memTotal] = (memUsage || '').split(' / ');
    return {
      cpu: parseFloat(cpuStr) || 0,
      memUsed: memUsed?.trim() || '0B',
      memTotal: memTotal?.trim() || '0B',
      memPercent: parseFloat(memPercStr) || 0,
      available: true,
    };
  } catch {
    return { cpu: 0, memUsed: '0B', memTotal: '0B', memPercent: 0, available: false };
  }
}

// ============ DOCKER LOGS ============
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  service: string;
  message: string;
  client: string;
}

export function getClientLogs(slug: string, lines = 100): LogEntry[] {
  const containerName = `${slug}_odoo`;
  try {
    const output = execSync(
      `${DOCKER_BIN} logs --tail ${lines} --timestamps ${containerName} 2>&1`,
      { timeout: 10000, encoding: 'utf-8' }
    );

    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line, i) => {
        const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)/);
        const timestamp = tsMatch ? tsMatch[1] : new Date().toISOString();
        const message = tsMatch ? tsMatch[2] : line;

        let level: LogEntry['level'] = 'INFO';
        if (/ERROR|CRITICAL|Traceback/i.test(message)) level = 'ERROR';
        else if (/WARNING|WARN/i.test(message)) level = 'WARNING';
        else if (/DEBUG/i.test(message)) level = 'DEBUG';

        const serviceMatch = message.match(/^(\w+):/);
        const service = serviceMatch ? serviceMatch[1] : 'odoo';

        return {
          id: `log_${slug}_${i}`,
          timestamp,
          level,
          service,
          message: message.slice(0, 500),
          client: slug,
        };
      });
  } catch {
    return [];
  }
}

// ============ CLIENT BRANCHES (from git) ============
interface BranchInfo {
  name: string;
  sha: string;
  current: boolean;
  remote: boolean;
  lastCommitDate: string | null;
  lastCommitAuthor: string | null;
  upstream: string | null;
  type: 'protected' | 'feature';
}

export function getClientBranches(slug: string): BranchInfo[] {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repoPath = client?.target_path || client?.path || `/home/pacadev/pacadev`;

  try {
    const raw = execSync(
      `git -C "${repoPath}" branch -a --format="%(refname:short)|%(objectname:short)|%(authordate:iso)|%(authorname)|%(upstream:short)"`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    const currentRaw = execSync(
      `git -C "${repoPath}" rev-parse --abbrev-ref HEAD`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();

    const seen = new Set<string>();
    const result: BranchInfo[] = [];

    for (const line of raw.split('\n').filter(Boolean)) {
      const [name, sha, date, author, upstream] = line.split('|');
      if (!name || name.includes('HEAD')) continue;
      const isRemote = name.startsWith('remotes/origin/');
      const cleanName = isRemote ? name.replace('remotes/origin/', '') : name;
      if (cleanName.includes('HEAD') || seen.has(cleanName)) continue;
      seen.add(cleanName);
      result.push({
        name: cleanName,
        sha: (sha || '').slice(0, 7),
        current: cleanName === currentRaw,
        remote: isRemote,
        lastCommitDate: (date || '').trim() || null,
        lastCommitAuthor: (author || '').trim() || null,
        upstream: (upstream || '').trim() || null,
        type: (cleanName === 'main' || cleanName === 'staging') ? 'protected' : 'feature',
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ============ CLIENT VERSIONS (from audit log) ============
export function getClientVersions(slug: string) {
  const audit = readAuditLog();
  const versions = readVersionsJSON();
  const client = versions.clients[slug];

  const deployEvents = audit
    .filter((a) => a.client === slug && ['deploy', 'work_done', 'migration_phase_done'].includes(a.action))
    .slice(0, 10);

  return {
    currentBranch: client?.current_branch || null,
    currentIssue: client?.current_issue || null,
    currentRepo: client?.current_repo || null,
    odooVersion: client?.odoo_version || null,
    status: client?.status || 'unknown',
    history: deployEvents.map((e) => ({
      id: e.id,
      action: e.action,
      timestamp: e.createdAt,
      user: e.user,
      details: e.details,
    })),
  };
}

// ============ ALERTS (from audit + docker) ============
interface ClientAlert {
  id: string;
  clientId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export function getClientAlerts(slug: string): ClientAlert[] {
  const docker = getDockerStatus(slug);
  const audit = readAuditLog();
  const alerts: ClientAlert[] = [];

  if (!docker.running) {
    alerts.push({
      id: `alert_${slug}_docker_down`,
      clientId: `cl_${slug}`,
      type: 'infrastructure',
      severity: 'critical',
      title: `Container ${docker.containerName} non actif`,
      message: `Le container Odoo pour ${slug} n'est pas en cours d'exécution.`,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    });
  }

  const errorLogs = getClientLogs(slug, 50).filter((l) => l.level === 'ERROR');
  if (errorLogs.length > 5) {
    alerts.push({
      id: `alert_${slug}_errors`,
      clientId: `cl_${slug}`,
      type: 'application',
      severity: 'warning',
      title: `${errorLogs.length} erreurs détectées dans les logs`,
      message: errorLogs[0]?.message?.slice(0, 200) || 'Erreurs dans les logs Odoo',
      acknowledged: false,
      createdAt: new Date().toISOString(),
    });
  }

  const recentErrors = audit
    .filter((a) => a.client === slug && a.action.includes('error'))
    .slice(0, 3);

  for (const err of recentErrors) {
    alerts.push({
      id: `alert_audit_${err.id}`,
      clientId: `cl_${slug}`,
      type: 'system',
      severity: 'warning',
      title: `Erreur système: ${err.action}`,
      message: err.details || err.action,
      acknowledged: false,
      createdAt: typeof err.createdAt === 'string' ? err.createdAt : new Date().toISOString(),
    });
  }

  return alerts;
}

// ============ CLI EXECUTOR ============
const PACADEV_BIN = '/home/pacadev/pacadev/.venv/bin/pacadev';

function readGitHubToken(): string {
  try {
    const hostsFile = '/home/pacadev/snap/gh/current/.config/gh/hosts.yml';
    const content = fs.readFileSync(hostsFile, 'utf-8');
    const match = content.match(/oauth_token:\s*(\S+)/);
    return match ? match[1] : '';
  } catch {
    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  }
}

function githubAPI(endpoint: string, timeoutMs = 15000): { success: boolean; data: unknown } {
  const token = readGitHubToken();
  if (!token) return { success: false, data: null };

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com/${endpoint}`;
  const result = spawnSync('curl', ['-sf', '-H', `Authorization: token ${token}`, '-H', 'Accept: application/vnd.github.v3+json', url], {
    encoding: 'utf-8',
    timeout: timeoutMs,
  });

  if (result.status !== 0 || !result.stdout) return { success: false, data: null };
  try {
    return { success: true, data: JSON.parse(result.stdout) };
  } catch {
    return { success: false, data: null };
  }
}

function githubAPIMutate(endpoint: string, method: 'POST' | 'PATCH', data: Record<string, unknown>): { success: boolean; data: unknown } {
  const token = readGitHubToken();
  if (!token) return { success: false, data: null };

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com/${endpoint}`;
  const result = spawnSync('curl', ['-sf', '-X', method, '-H', `Authorization: token ${token}`, '-H', 'Accept: application/vnd.github.v3+json', '-H', 'Content-Type: application/json', '-d', JSON.stringify(data), url], {
    encoding: 'utf-8',
    timeout: 15000,
  });

  if (result.status !== 0 || !result.stdout) return { success: false, data: null };
  try {
    return { success: true, data: JSON.parse(result.stdout) };
  } catch {
    return { success: false, data: null };
  }
}

interface CLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCLI(bin: string, args: string[], timeoutMs = 30000): CLIResult {
  const result = spawnSync(bin, args, {
    encoding: 'utf-8',
    timeout: timeoutMs,
    env: { ...process.env, HOME: '/home/pacadev', PATH: '/snap/bin:/usr/bin:/bin:/home/pacadev/pacadev/.venv/bin', GH_CONFIG_DIR: '/home/pacadev/snap/gh/current/.config/gh' },
  });
  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  };
}

// ============ WORK START / STOP ============
export function workStart(slug: string, issue: number, module?: string) {
  const args = ['work', 'start', '--client', slug, '--issue', String(issue)];
  if (module) args.push('--module', module);
  const result = runCLI(PACADEV_BIN, args, 45000);

  const versions = readVersionsJSON();
  const clientData = versions.clients[slug];
  const branch = module
    ? `dev/${slug}/${issue}-${module}`
    : `dev/${slug}/${issue}-task`;

  return {
    success: result.success,
    branch: clientData?.current_branch || branch,
    issue,
    client: slug,
    fsmState: result.success ? 'working' : 'error',
    message: result.success
      ? `Environnement de travail démarré pour issue #${issue} — ${slug}`
      : `Erreur: ${result.stderr.slice(0, 300)}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function workStop(slug: string) {
  const result = runCLI(PACADEV_BIN, ['work', 'stop', '--client', slug], 30000);
  return {
    success: result.success,
    client: slug,
    fsmState: result.success ? 'idle' : 'error',
    message: result.success
      ? `Environnement de travail arrêté — ${slug}`
      : `Erreur: ${result.stderr.slice(0, 300)}`,
    stdout: result.stdout,
  };
}

// ============ DEPLOY ============
export function deployApprove(slug: string, env: 'staging' | 'prod', reason: string, module?: string, approveToken?: string, dryRun = false) {
  const args = ['deploy', 'approve', '--client', slug, '--env', env, '--reason', reason];
  if (module) args.push('--module', module);
  if (approveToken) args.push('--approve-token', approveToken);
  if (dryRun) args.push('--dry-run');

  const result = runCLI(PACADEV_BIN, args, 120000);
  return {
    success: result.success,
    client: slug,
    environment: env,
    dryRun,
    message: result.success
      ? `Déploiement ${dryRun ? '(dry-run) ' : ''}${env} initié pour ${slug}`
      : `Erreur déploiement: ${result.stderr.slice(0, 500)}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// ============ ROLLBACK ============
export function rollbackClient(slug: string, backup: string, dryRun = true) {
  const args = ['rollback', 'run', '--client', slug];
  if (backup) args.push('--backup', backup);
  if (dryRun) args.push('--dry-run');

  const result = runCLI(PACADEV_BIN, args, 120000);
  return {
    success: result.success,
    client: slug,
    backup,
    dryRun,
    steps: [
      { step: 'stop_services', status: result.success ? 'done' : 'skipped' },
      { step: 'restore_database', status: result.success ? 'done' : 'skipped' },
      { step: 'restore_filestore', status: result.success ? 'done' : 'skipped' },
      { step: 'start_services', status: result.success ? 'done' : 'skipped' },
    ],
    message: result.success
      ? `Rollback ${dryRun ? '(dry-run) ' : ''}vers ${backup} effectué pour ${slug}`
      : `Erreur rollback: ${result.stderr.slice(0, 500)}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// ============ BACKUPS ============
interface BackupEntry {
  id: string;
  client: string;
  timestamp: string;
  size: number | null;
  status: string;
  type: string;
  path: string | null;
}

export function getClientBackups(slug: string): BackupEntry[] {
  const backups: BackupEntry[] = [];

  // Scan /tmp for real backup files
  try {
    const tmpFiles = fs.readdirSync('/tmp').filter(f => f.startsWith(`pacadev-backup-`) && f.endsWith('.tar.gz'));
    for (const f of tmpFiles) {
      const fullPath = `/tmp/${f}`;
      const stat = fs.statSync(fullPath);
      const id = f.replace('pacadev-backup-', '').replace('.tar.gz', '');
      // Extract date from id (bk-YYYYMMDD-HHMM)
      const dateMatch = id.match(/bk-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
      const timestamp = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:00Z`
        : stat.mtime.toISOString();

      backups.push({
        id,
        client: slug,
        timestamp,
        size: stat.size,
        status: 'completed',
        type: 'full',
        path: fullPath,
      });
    }
  } catch { /* /tmp not readable */ }

  // Read deploy events from audit log as backup markers
  const audit = readAuditLog();
  const deployEvents = audit.filter(a => a.client === slug && a.action === 'deploy');
  for (const ev of deployEvents.slice(0, 5)) {
    backups.push({
      id: `deploy-${ev.id}`,
      client: slug,
      timestamp: typeof ev.createdAt === 'string' ? ev.createdAt : new Date().toISOString(),
      size: null,
      status: 'completed',
      type: 'db_only',
      path: null,
    });
  }

  return backups;
}

// ============ APPROVALS ============
interface ApprovalEntry {
  timestamp: string;
  token: string;
  client: string;
  action: string;
  reason: string;
  user: string;
  used: boolean;
  used_at: string | null;
  used_by: string | null;
}

export function getApprovals(slug?: string): ApprovalEntry[] {
  const file = path.join(PACADEV_HOME, 'approvals.jsonl');
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return data.trim().split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as ApprovalEntry)
      .filter(a => !slug || a.client === slug)
      .reverse();
  } catch {
    return [];
  }
}

// ============ PIPELINE (GitHub Actions) ============
interface PipelineRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  commitHash: string | null;
  createdAt: string;
  url: string;
  jobs: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    steps: Array<{ name: string; conclusion: string | null }>;
  }>;
}

export function getClientPipeline(slug: string, limit = 5): PipelineRun[] {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';

  try {
    const runsResp = githubAPI(`repos/${repo}/actions/runs?per_page=${limit}`);
    if (!runsResp.success || !runsResp.data) return [];

    const runsData = runsResp.data as { workflow_runs: Array<{id:number;name:string;status:string;conclusion:string|null;head_branch:string;head_sha:string;created_at:string;html_url:string}> };
    const runs = (runsData.workflow_runs || []).slice(0, limit);

    return runs.map(run => {
      let jobs: PipelineRun['jobs'] = [];
      try {
        const jobsResp = githubAPI(`repos/${repo}/actions/runs/${run.id}/jobs`, 10000);
        if (jobsResp.success && jobsResp.data) {
          const jobsData = jobsResp.data as { jobs: Array<{name:string;status:string;conclusion:string|null;steps:Array<{name:string;conclusion:string|null}>}> };
          jobs = (jobsData.jobs || []).map(j => ({
            name: j.name,
            status: j.status,
            conclusion: j.conclusion,
            steps: (j.steps || []).map(s => ({ name: s.name, conclusion: s.conclusion })),
          }));
        }
      } catch { /* skip jobs on error */ }

      return {
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        commitHash: run.head_sha?.slice(0, 8) || null,
        createdAt: run.created_at,
        url: run.html_url,
        jobs,
      };
    });
  } catch {
    return [];
  }
}

export function retriggerPipeline(slug: string, workflowFile = 'pipeline.yml') {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';
  const branch = client?.current_branch || 'main';
  const token = readGitHubToken();

  if (!token) {
    return { success: false, repo, branch, workflow: workflowFile, message: 'Token GitHub non disponible' };
  }

  // POST to trigger workflow dispatch via curl
  const body = JSON.stringify({ ref: branch });
  const result = spawnSync('curl', [
    '-sf', '-X', 'POST',
    '-H', `Authorization: token ${token}`,
    '-H', 'Accept: application/vnd.github.v3+json',
    '-H', 'Content-Type: application/json',
    '-d', body,
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
  ], { encoding: 'utf-8', timeout: 15000 });

  return {
    success: result.status === 0,
    repo,
    branch,
    workflow: workflowFile,
    message: result.status === 0
      ? `Pipeline déclenché sur ${branch} — ${repo}`
      : `Erreur: ${result.stderr?.slice(0, 300) || 'curl failed'}`,
  };
}

// ============ PHASE 4: SERVICES (Docker réels) ============
interface ServiceInfo {
  id: string;
  name: string;
  type: string;
  status: 'up' | 'down' | 'degraded';
  containerName: string;
  port: string | null;
  health: string;
  client: string | null;
}

export function getRealServices(): ServiceInfo[] {
  try {
    const output = execSync(
      `${DOCKER_BIN} ps --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}" --no-trunc`,
      { encoding: 'utf-8', timeout: 8000 }
    ).trim();

    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line, i) => {
      const [name, statusRaw, ports] = line.split('\t');
      const portMatch = ports?.match(/0\.0\.0\.0:(\d+)->/);
      const running = statusRaw?.includes('Up');
      const healthy = statusRaw?.includes('healthy');

      const clientMatch = name?.match(/^([a-z_]+)_odoo/);
      const client = clientMatch ? clientMatch[1] : null;

      let type = 'docker';
      if (name?.includes('postgres') || name?.includes('db')) type = 'db';
      else if (name?.includes('traefik')) type = 'traefik';
      else if (name?.includes('redis') || name?.includes('mq')) type = 'messaging';

      return {
        id: `svc_${i}_${name}`,
        name,
        type,
        status: running ? (healthy ? 'up' : 'up') : 'down',
        containerName: name,
        port: portMatch ? portMatch[1] : null,
        health: healthy ? 'healthy' : running ? 'running' : 'down',
        client,
      };
    });
  } catch {
    return [];
  }
}

// ============ PHASE 4: GITHUB ISSUES ============
interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  assignees: string[];
  client: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  body: string | null;
}

export function getGitHubIssues(repo: string, state = 'open', limit = 20): GitHubIssue[] {
  const resp = githubAPI(`repos/${repo}/issues?state=${state}&per_page=${limit}`, 15000);
  if (!resp.success || !resp.data) return [];

  const issues = resp.data as Array<{
    number: number;
    title: string;
    state: string;
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
    html_url: string;
    created_at: string;
    updated_at: string;
    body: string | null;
    pull_request?: object;
  }>;

  return issues
    .filter(i => !i.pull_request)
    .map(i => {
      const labels = i.labels.map(l => l.name);
      const clientLabel = labels.find(l => l.startsWith('client:'));
      const client = clientLabel ? clientLabel.replace('client:', '') : null;
      return {
        number: i.number,
        title: i.title,
        state: i.state,
        labels,
        assignees: i.assignees.map(a => a.login),
        client,
        url: i.html_url,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        body: i.body?.slice(0, 500) || null,
      };
    });
}

export function getClientIssues(slug: string, state = 'all', limit = 20): GitHubIssue[] {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';
  const issues = getGitHubIssues(repo, state, limit);
  return issues.filter(i => i.client === slug || i.labels.some(l => l.includes(slug)));
}

export function updateClientIssue(
  slug: string,
  issueNumber: number,
  updates: { comment?: string; close?: boolean; label?: string }
): { success: boolean; message: string } {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';

  if (updates.comment) {
    const resp = githubAPIMutate(`repos/${repo}/issues/${issueNumber}/comments`, 'POST', { body: updates.comment });
    if (!resp.success) return { success: false, message: `Échec ajout commentaire sur ${repo}#${issueNumber}` };
  }

  if (updates.label || updates.close) {
    const patch: Record<string, unknown> = {};
    if (updates.label) patch.labels = [updates.label];
    if (updates.close) patch.state = 'closed';
    const resp = githubAPIMutate(`repos/${repo}/issues/${issueNumber}`, 'PATCH', patch);
    if (!resp.success) return { success: false, message: `Échec mise à jour de ${repo}#${issueNumber}` };
  }

  return { success: true, message: `${repo}#${issueNumber} mis à jour` };
}

// ============ PHASE 4: AI RISK FROM PIPELINE ============
export function getAIRiskFromPipeline(slug: string) {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';

  try {
    const runsResp = githubAPI(`repos/${repo}/actions/runs?per_page=3`);
    if (!runsResp.success || !runsResp.data) return null;

    const runsData = runsResp.data as { workflow_runs: Array<{ id: number; conclusion: string | null; head_sha: string; created_at: string }> };
    const latestRun = runsData.workflow_runs[0];
    if (!latestRun) return null;

    const jobsResp = githubAPI(`repos/${repo}/actions/runs/${latestRun.id}/jobs`);
    if (!jobsResp.success || !jobsResp.data) return null;

    const jobsData = jobsResp.data as { jobs: Array<{ name: string; conclusion: string | null; steps: Array<{ name: string; conclusion: string | null; output?: { text?: string } }> }> };
    const aiRiskJob = jobsData.jobs.find(j => j.name.toLowerCase().includes('ai') || j.name.toLowerCase().includes('risk'));

    if (!aiRiskJob) return null;

    const conclusion = aiRiskJob.conclusion;
    const score = conclusion === 'success' ? 0.15 : conclusion === 'failure' ? 0.85 : 0.5;

    return {
      runId: latestRun.id,
      commitHash: latestRun.head_sha.slice(0, 8),
      score,
      conclusion,
      recommendation: score < 0.3 ? 'auto_merge' : score < 0.7 ? 'review_required' : 'manual_only',
      steps: aiRiskJob.steps.map(s => ({ name: s.name, conclusion: s.conclusion })),
      runAt: latestRun.created_at,
      url: `https://github.com/${repo}/actions/runs/${latestRun.id}`,
    };
  } catch {
    return null;
  }
}

// ============ PHASE 4: SECURITY SCAN FROM CI ============
export function getSecurityScan(slug: string) {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  const repo = client?.current_repo || 'ENSWORK/pacadev';

  try {
    const runsResp = githubAPI(`repos/${repo}/actions/runs?per_page=3`);
    if (!runsResp.success || !runsResp.data) return null;

    const runsData = runsResp.data as { workflow_runs: Array<{ id: number; head_sha: string; created_at: string }> };
    const latestRun = runsData.workflow_runs[0];
    if (!latestRun) return null;

    const jobsResp = githubAPI(`repos/${repo}/actions/runs/${latestRun.id}/jobs`);
    if (!jobsResp.success || !jobsResp.data) return null;

    const jobsData = jobsResp.data as { jobs: Array<{ name: string; conclusion: string | null; steps: Array<{ name: string; conclusion: string | null }> }> };
    const secJob = jobsData.jobs.find(j => j.name.toLowerCase().includes('security') || j.name.toLowerCase().includes('lint'));

    const banditStep = secJob?.steps.find(s => s.name.toLowerCase().includes('bandit'));
    const gitleaksStep = secJob?.steps.find(s => s.name.toLowerCase().includes('gitleak'));

    return {
      runId: latestRun.id,
      commitHash: latestRun.head_sha.slice(0, 8),
      scannedAt: latestRun.created_at,
      bandit: {
        conclusion: banditStep?.conclusion || 'unknown',
        passed: banditStep?.conclusion === 'success',
      },
      gitleaks: {
        conclusion: gitleaksStep?.conclusion || 'unknown',
        passed: gitleaksStep?.conclusion === 'success',
      },
      overallOk: secJob?.conclusion === 'success',
      riskScore: secJob?.conclusion === 'success' ? 0.05 : 0.9,
      url: `https://github.com/${repo}/actions/runs/${latestRun.id}`,
    };
  } catch {
    return null;
  }
}

// ============ PHASE 4: SESSION / AUTH ============
export function getRealUser() {
  const rbac = readRBACJSON();
  const userResult = spawnSync('whoami', [], { encoding: 'utf-8', timeout: 2000 });
  const login = userResult.stdout?.trim() || 'pacadev';

  const userRole = (rbac.users || {})[login]?.role || 'lead';
  const rolePerms = rbac.roles[userRole]?.permissions || [];

  return {
    id: `user_${login}`,
    email: 'dg.enswork@gmail.com',
    name: login,
    role: userRole,
    permissions: rolePerms,
    githubLogin: 'a-bahou',
    sessionStart: new Date(Date.now() - 3600_000).toISOString(),
    expiresAt: new Date(Date.now() + 7200_000).toISOString(),
  };
}

// ============ PHASE 4: WORKFLOW STATE FROM GITHUB ISSUE ============
export function getWorkflowState(ticketId: number, slug?: string) {
  const versions = readVersionsJSON();
  const clients = versions.clients;

  // Find which client has this issue
  let repo = 'ENSWORK/pacadev';
  for (const [clientSlug, data] of Object.entries(clients)) {
    if (data.current_issue === `#${ticketId}` || (slug && slug === clientSlug)) {
      repo = data.current_repo || repo;
      break;
    }
  }

  try {
    const issueResp = githubAPI(`repos/${repo}/issues/${ticketId}`, 10000);
    if (!issueResp.success || !issueResp.data) return null;

    const issue = issueResp.data as { number: number; title: string; state: string; labels: Array<{ name: string }>; assignees: Array<{ login: string }> };
    const labels = issue.labels.map(l => l.name);

    // Map labels to workflow step
    const getStepStatus = (step: string) => {
      if (labels.includes(`status:${step}`)) return 'in_progress';
      if (['type:feature', 'type:bug'].some(l => labels.includes(l)) && step === 'ticket') return 'completed';
      if (issue.state === 'closed' && ['ticket', 'development', 'cicd', 'staging', 'validation', 'production'].includes(step)) return 'completed';
      return 'pending';
    };

    return {
      ticketId,
      title: issue.title,
      state: issue.state,
      assignees: issue.assignees.map(a => a.login),
      steps: [
        { id: 'ticket', label: 'Ticket', status: 'completed', details: `#${issue.number} — ${issue.title.slice(0, 60)}` },
        { id: 'development', label: 'Développement', status: getStepStatus('in-progress') },
        { id: 'cicd', label: 'CI/CD', status: getStepStatus('staging') === 'in_progress' || issue.state === 'closed' ? 'completed' : 'pending' },
        { id: 'staging', label: 'Staging', status: getStepStatus('staging') },
        { id: 'validation', label: 'Validation', status: getStepStatus('validated') },
        { id: 'production', label: 'Production', status: issue.state === 'closed' ? 'completed' : 'pending' },
      ],
    };
  } catch {
    return null;
  }
}
