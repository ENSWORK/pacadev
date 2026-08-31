// PACADEV Web UI - TypeScript Types

export type ClientStatus = 'dev' | 'staging' | 'prod';
export type Environment = 'staging' | 'prod';
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type PipelineStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
export type ModuleSource = 'oca' | 'custom';
export type ModuleStatus = 'installed' | 'disabled' | 'upgrade_available';
export type BackupStatus = 'completed' | 'uploading' | 'failed' | 'verifying';
export type BackupType = 'full' | 'db_only';
export type ServiceType = 'docker' | 'tailscale' | 'db' | 'traefik';
export type ServiceStatus = 'up' | 'down' | 'degraded';
export type SuggestionType = 'fix_lint' | 'migration' | 'missing_test' | 'refactor' | 'security';
export type SuggestionStatus = 'pending' | 'applied' | 'ignored' | 'modified';
export type RiskRecommendation = 'auto_merge' | 'review_required' | 'manual_only';
export type UserRole = 'dev' | 'lead' | 'admin' | 'client';

// ============ Workspace Types ============
export type TicketType = 'feature' | 'bug' | 'hotfix' | 'refacto';
export type WorkflowStep = 'ticket' | 'development' | 'cicd' | 'staging' | 'validation' | 'production';
export type WorkflowStepStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

export interface TicketCreationData {
  client: string;
  type: TicketType;
  module: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  impactFlags: {
    db: boolean;
    xml: boolean;
    security: boolean;
    performance: boolean;
  };
}

export interface WorkSession {
  id: string;
  ticketId: number;
  clientSlug: string;
  branchName: string;
  odooVersion: string;
  modules: string[];
  startedAt: string;
  status: 'active' | 'paused' | 'stopped';
}

export interface WorkflowState {
  ticketId: number;
  steps: {
    id: WorkflowStep;
    label: string;
    status: WorkflowStepStatus;
    details?: string;
    responsible?: string;
    since?: string;
  }[];
}

export interface SecretFilterResult {
  passwordsBlocked: number;
  apiKeysBlocked: number;
  tokensBlocked: number;
  lastCheck: string;
  totalAttempts: number;
}

export interface BackupSecurityInfo {
  encryptionEnabled: boolean;
  encryptionKeyId: string;
  lastKeyRotation: string;
  nextKeyRotation: string;
  lastIntegrityCheck: string;
  integrityCheckOk: boolean;
  retentionDays: number;
  encryptedBackupsPercent: number;
  lastRestoreTest: string;
  restoreTestOk: boolean;
}

export interface SecurityScanResult {
  secretsScanOk: boolean;
  secretsCount: number;
  commitSignaturesVerified: boolean;
  riskScore: number;
  lastScanAt: string;
}

export interface AuditStreamEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  client: string | null;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  commandHash: string | null;
}

// ============ Core Types ============

export interface ClientData {
  id: string;
  slug: string;
  name: string;
  odooVersion: string;
  status: ClientStatus;
  stagingUrl: string | null;
  prodUrl: string | null;
  tailscaleIp: string | null;
  aclGroup: string | null;
  contacts: string | null;
  lastActivity: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ClientModule {
  id: string;
  clientId: string;
  name: string;
  version: string | null;
  source: ModuleSource;
  status: ModuleStatus;
  lastUpdated: Date | string;
}

export interface Deployment {
  id: string;
  clientId: string;
  environment: Environment;
  versionTag: string | null;
  triggeredBy: string | null;
  triggerReason: string | null;
  status: DeploymentStatus;
  startedAt: Date | string;
  completedAt: Date | string | null;
  backupId: string | null;
  healthWeb: string | null;
  healthDb: string | null;
  healthCron: string | null;
  rollbackAvailable: boolean;
}

export interface Backup {
  id: string;
  clientId: string;
  timestamp: Date | string;
  size: number;
  checksum: string | null;
  status: BackupStatus;
  uploadOk: boolean;
  retention: string;
  type: BackupType;
}

export interface Alert {
  id: string;
  clientId: string | null;
  level: AlertLevel;
  source: string;
  message: string;
  status: AlertStatus;
  acknowledgedBy: string | null;
  createdAt: Date | string;
}

export interface AIRisk {
  id: string;
  clientId: string;
  commitHash: string | null;
  score: number;
  schemaChanges: number;
  securityPatterns: number;
  depChanges: number;
  bizLogicChanges: number;
  recommendation: RiskRecommendation | null;
  explanation: string | null;
  requiresReview: boolean;
}

export interface AISuggestion {
  id: string;
  clientId: string;
  type: SuggestionType;
  title: string;
  description: string | null;
  codeDiff: string | null;
  impact: string | null;
  status: SuggestionStatus;
  appliedBy: string | null;
  appliedAt: Date | string | null;
}

export interface Pipeline {
  id: string;
  clientId: string;
  commitHash: string | null;
  branch: string | null;
  trigger: string | null;
  status: string;
  lintStatus: PipelineStepStatus;
  testsStatus: PipelineStepStatus;
  securityStatus: PipelineStepStatus;
  aiRiskStatus: PipelineStepStatus;
  deployStatus: PipelineStepStatus;
  duration: number | null;
  logs: string | null;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  client: string | null;
  details: string | null;
  reason: string | null;
  createdAt: Date | string;
}

export interface AIConfig {
  id: string;
  model: string;
  maxTokens: number;
  fallbackModel: string | null;
  costThreshold: number | null;
  autoMerge: boolean;
  autoDeploy: boolean;
  autoRollback: boolean;
}

export interface ServiceHealth {
  id: string;
  name: string;
  type: ServiceType;
  status: ServiceStatus;
  url: string | null;
  lastCheck: Date | string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    user: string;
    client?: string;
    cli_equivalent?: string;
    total?: number;
    source?: string;
    [key: string]: unknown;
  };
  warnings?: string[];
  errors?: string[];
}

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  ip?: string;
  startedAt?: string;
  expiresAt?: string;
  mfaEnabled?: boolean;
}

export interface HealthCheck {
  clientId: string;
  slug: string;
  dockerRunning: boolean;
  dockerStatus: string;
  dockerHealth: string;
  dbAccessible: boolean;
  filestoreReadable: boolean;
  configValid: boolean;
  odooResponding: boolean;
  odooUrl: string | null;
  lastCheck: string;
  checks: {
    name: string;
    ok: boolean;
    detail: string;
  }[];
  overall: 'healthy' | 'degraded' | 'down';
}

export interface DashboardStats {
  totalClients: number;
  activeDeployments: number;
  criticalAlerts: number;
  iaTokensUsed: number;
  iaCostEstimated: number;
  servicesUp: number;
  servicesTotal: number;
}
