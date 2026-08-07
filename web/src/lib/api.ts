/**
 * PACADEV Centralized API Client
 *
 * Maps every PACADEV CLI command to Web API calls.
 * CLI equivalents are documented for each method.
 *
 * Architecture:
 *   Web UI → Next.js API Routes → (future) FastAPI → pacadev CLI
 *
 * Currently API routes return mock/structured data.
 * When FastAPI backend is connected, only the route handlers need updating.
 */

import type { APIResponse } from './types'

// ─── Base fetch helper ────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.errors?.join(', ') ?? `API Error ${res.status}`)
  }
  return json
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  /** CLI: pacadev health --all */
  getStats: () => apiFetch<unknown>('/api/dashboard'),

  /** CLI: pacadev health --client <slug> */
  refreshHealth: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/validate`),
}

// ─── Clients ───────────────────────────────────────────────────────────────
export const clientsApi = {
  /** CLI: pacadev list */
  list: () => apiFetch<unknown[]>('/api/clients'),

  /** CLI: pacadev health --client <slug> */
  get: (slug: string) => apiFetch<unknown>(`/api/clients/${slug}`),

  /** CLI: pacadev init <slug> --odoo <ver> */
  init: (slug: string, odooVersion: string, template = 'standard') =>
    apiFetch<unknown>('/api/clients', {
      method: 'POST',
      body: JSON.stringify({ slug, odooVersion, template }),
    }),
}

// ─── Work ──────────────────────────────────────────────────────────────────
export const workApi = {
  /** CLI: pacadev work start --client <slug> --issue <N> --module <M> */
  start: (clientSlug: string, issue: number, module?: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/work/start`, {
      method: 'POST',
      body: JSON.stringify({ issue, module }),
    }),

  /** CLI: pacadev work stop --client <slug> */
  stop: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/work/stop`, {
      method: 'POST',
    }),

  /** CLI: pacadev work status */
  status: () => apiFetch<unknown>('/api/clients/work/status'),
}

// ─── Deploy ────────────────────────────────────────────────────────────────
export const deployApi = {
  /** CLI: pacadev deploy approve --client <slug> --env <env> [--approve-token <tok>] */
  approve: (clientSlug: string, env: 'staging' | 'prod', reason?: string, approveToken?: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ environment: env, reason, approveToken }),
    }),

  /** CLI: pacadev deploy generate_approval --client <slug> --action <action> --reason <reason> */
  generateApproval: (clientSlug: string, action: string, reason: string) =>
    apiFetch<{ token: string }>(`/api/clients/${clientSlug}/deploy/approval`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),

  /** CLI: pacadev deploy approve --dry-run */
  dryRun: (clientSlug: string, env: 'staging' | 'prod') =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ environment: env, dryRun: true }),
    }),
}

// ─── Backup ────────────────────────────────────────────────────────────────
export const backupApi = {
  /** CLI: pacadev backup list --client <slug> */
  list: (clientSlug: string) =>
    apiFetch<unknown[]>(`/api/clients/${clientSlug}/backups`),

  /** CLI: pacadev backup create --client <slug> */
  create: (clientSlug: string, type: 'full' | 'db_only' = 'full') =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/backups`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  /** Verify backup integrity */
  verify: (clientSlug: string, backupId: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/backups/${backupId}/verify`, {
      method: 'POST',
    }),

  /** Download backup archive */
  download: (clientSlug: string, backupId: string) =>
    `/api/clients/${clientSlug}/backups/${backupId}/download`,
}

// ─── Rollback ──────────────────────────────────────────────────────────────
export const rollbackApi = {
  /** CLI: pacadev rollback --client <slug> --backup <id> */
  execute: (clientSlug: string, backupId: string, reason?: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ backupId, reason }),
    }),

  /** CLI: pacadev rollback --client <slug> --backup <id> --dry-run */
  dryRun: (clientSlug: string, backupId: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/rollback/dry-run`, {
      method: 'POST',
      body: JSON.stringify({ backupId }),
    }),
}

// ─── Pipeline ──────────────────────────────────────────────────────────────
export const pipelineApi = {
  /** List pipelines for a client */
  list: (clientSlug: string) =>
    apiFetch<unknown[]>(`/api/clients/${clientSlug}/pipeline`),

  /** CLI: retrigger a failed/completed pipeline */
  retrigger: (clientSlug: string, pipelineId: string, step?: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/pipeline/retrigger`, {
      method: 'POST',
      body: JSON.stringify({ pipelineId, step }),
    }),
}

// ─── Issues (GitHub) ──────────────────────────────────────────────────────
export const issueApi = {
  /** CLI: pacadev issue create --client <slug> --module <M> --title <T> */
  create: (clientSlug: string, module: string, title: string, milestone?: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/issues`, {
      method: 'POST',
      body: JSON.stringify({ module, title, milestone }),
    }),

  /** CLI: pacadev issue update <N> --comment <C> / --close / --label <L> */
  update: (clientSlug: string, issueNumber: number, updates: { comment?: string; close?: boolean; label?: string }) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
}

// ─── Secrets ───────────────────────────────────────────────────────────────
export const secretsApi = {
  /** CLI: pacadev secrets show <slug> */
  show: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/secrets`),

  /** CLI: pacadev secrets init <slug> */
  init: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/secrets`, { method: 'POST' }),

  /** CLI: pacadev secrets edit <slug> */
  edit: (clientSlug: string, secrets: Record<string, string>) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/secrets`, {
      method: 'PUT',
      body: JSON.stringify(secrets),
    }),
}

// ─── Monitoring ────────────────────────────────────────────────────────────
export const monitorApi = {
  /** CLI: pacadev monitor start */
  start: (password?: string) =>
    apiFetch<unknown>('/api/services', {
      method: 'POST',
      body: JSON.stringify({ action: 'monitor_start', password }),
    }),

  /** CLI: pacadev monitor stop */
  stop: () =>
    apiFetch<unknown>('/api/services', {
      method: 'POST',
      body: JSON.stringify({ action: 'monitor_stop' }),
    }),

  /** CLI: pacadev monitor status */
  status: () => apiFetch<unknown>('/api/services'),

  /** CLI: pacadev monitor logs <service> */
  logs: (service: string) =>
    apiFetch<unknown>(`/api/services/logs?service=${service}`),

  /** Restart a service container */
  restartService: (clientSlug: string, service: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/services/restart`, {
      method: 'POST',
      body: JSON.stringify({ service }),
    }),
}

// ─── Tests ─────────────────────────────────────────────────────────────────
export const testApi = {
  /** CLI: pacadev test run --client <slug> --module <M> */
  run: (clientSlug: string, module: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/smoke-test`, {
      method: 'POST',
      body: JSON.stringify({ module }),
    }),
}

// ─── AI / Risk ─────────────────────────────────────────────────────────────
export const aiApi = {
  /** Get AI risk score for a client */
  getRisk: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/ai/risk`),

  /** Get AI suggestions */
  getSuggestions: (clientSlug: string) =>
    apiFetch<unknown[]>(`/api/clients/${clientSlug}/ai/suggestions`),

  /** Get AI config */
  getConfig: () => apiFetch<unknown>('/api/ai/config'),

  /** Update AI config */
  updateConfig: (config: Record<string, unknown>) =>
    apiFetch<unknown>('/api/ai/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
}

// ─── Audit ─────────────────────────────────────────────────────────────────
export const auditApi = {
  /** Get audit logs */
  list: (filters?: { client?: string; action?: string; user?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (filters?.client) params.set('client', filters.client)
    if (filters?.action) params.set('action', filters.action)
    if (filters?.user) params.set('user', filters.user)
    if (filters?.from) params.set('from', filters.from)
    if (filters?.to) params.set('to', filters.to)
    const qs = params.toString()
    return apiFetch<unknown[]>(`/api/audit${qs ? `?${qs}` : ''}`)
  },

  /** Export audit logs */
  export: (format: 'csv' | 'json' | 'pdf' = 'json', filters?: { client?: string; action?: string }) => {
    const params = new URLSearchParams()
    params.set('format', format)
    if (filters?.client) params.set('client', filters.client)
    if (filters?.action) params.set('action', filters.action)
    return `/api/audit/export?${params.toString()}`
  },
}

// ─── Tickets (Workspace) ───────────────────────────────────────────────────
export const ticketApi = {
  /** CLI: pacadev issue create --client <slug> --module <M> --title <T> --body <B> */
  create: (data: {
    client: string
    type: string
    module: string
    title: string
    description: string
    acceptanceCriteria?: string[]
    impactFlags?: { db: boolean; xml: boolean; security: boolean; performance: boolean }
  }) =>
    apiFetch<unknown>(`/api/clients/${data.client}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** CLI: pacadev issue list --client <slug> */
  list: (clientSlug: string) =>
    apiFetch<unknown[]>(`/api/clients/${clientSlug}/issues`),
}

// ─── Workflow ──────────────────────────────────────────────────────────────
export const workflowApi = {
  /** Get workflow state for a ticket */
  getState: (clientSlug: string, ticketId: number) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/workflow/${ticketId}/state`),

  /** Update workflow step */
  updateStep: (clientSlug: string, ticketId: number, step: string, action: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/workflow/${ticketId}/step`, {
      method: 'POST',
      body: JSON.stringify({ step, action }),
    }),
}

// ─── Security ──────────────────────────────────────────────────────────────
export const securityApi = {
  /** Run security scan on pipeline */
  scanPipeline: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/secrets`, {
      method: 'POST',
      body: JSON.stringify({ action: 'scan' }),
    }),

  /** Test secret filtering */
  testFilter: () =>
    apiFetch<unknown>('/api/ai/config', {
      method: 'PUT',
      body: JSON.stringify({ testFilter: true }),
    }),

  /** Get security scan result */
  getScanResult: (clientSlug: string) =>
    apiFetch<unknown>(`/api/clients/${clientSlug}/secrets`),
}

// ─── Runbook ───────────────────────────────────────────────────────────────
export const runbookApi = {
  /** CLI: pacadev runbook show <section> */
  show: (section?: string) =>
    apiFetch<unknown>(`/api/runbook${section ? `?section=${section}` : ''}`),

  /** CLI: pacadev runbook emergency <client> */
  emergency: (clientSlug: string) =>
    apiFetch<unknown>(`/api/runbook/emergency?client=${clientSlug}`),
}
