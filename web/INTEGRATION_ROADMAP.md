# 🗺️ ROADMAP — Web UI ↔ PACADEV Integration

**Status**: Phase 1 ✅ Complete | Phase 2-4 Ready to start  
**Last Updated**: 2026-05-15  
**Owner**: PACADEV Web UI Integration

---

## 📊 Executive Summary

| Phase | Scope | Files Changed | Est. Time | Status |
|-------|-------|---------------|-----------| -------|
| **Phase 1** | Service layer + Dashboard/Clients/Audit read | `pacadev-service.ts` + 3 routes | ✅ Done | Live |
| **Phase 2** | Modules / Logs / Branches / Health checks | 8 routes + 4 service functions | 🔄 Ready | Blocked |
| **Phase 3** | Work/Deploy/Rollback/Backup actions (CLI wrapper) | 6 routes + security layer | 🔄 Ready | Blocked |
| **Phase 4** | Real-time observability (WebSocket, streaming) | WebSocket handler + 4 routes | 🔄 Ready | Blocked |

**Total Effort**: ~40 hours of development remaining

---

## ✅ PHASE 1 — Complete (Baseline Data Access)

### Completed Tasks
- [x] Create `src/lib/pacadev-service.ts` — read versions.json, audit-log.jsonl, config.yaml, rbac.json
- [x] Adapt `GET /api/clients` → reads 5 real PACADEV clients (afrequip, specta, mecafric, mecafric_water, acmecorp)
- [x] Adapt `GET /api/clients/{slug}` → returns individual client from versions.json
- [x] Adapt `GET /api/dashboard` → aggregates real audit log
- [x] Adapt `GET /api/audit` → streams real PACADEV audit-log.jsonl with hash-chain preservation
- [x] Validate all routes return HTTP 200 with real data

### Deliverables
- ✅ Web UI connected to PACADEV state directory
- ✅ 5 real clients visible (status: dev/done/migrated)
- ✅ Real audit history immutable & displayed

---

## 🔄 PHASE 2 — Modules / Logs / Git / Health (2-3 days)

### 2.1 — Modules Discovery

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/modules/route.ts`

**Task**: Scan `v{VERSION}/clients/{slug}/addons/` directories and return module list with versions

```typescript
// Function to add to pacadev-service.ts
export function getClientModules(slug: string): ClientModule[] {
  // Read from:
  // - v14/clients/{slug}/addons/oca/ (OCA modules, large)
  // - v14/clients/{slug}/addons/ens_core/ (custom ENSWORK)
  // - v17/clients/{slug}/addons/oca/
  // - v17/clients/{slug}/addons/ens_core/
  
  // Extract from __manifest__.py:
  //   - name, version, license, author, category
  //   - status: installed | disabled | upgrade_available
  
  // Return: ClientModule[] sorted by source (oca/custom)
}
```

**Routes to implement**:
- `GET /api/clients/{slug}/modules` → list all modules
- `GET /api/clients/{slug}/modules/{name}` → module details (optional)

**Real clients data**:
- afrequip (v17): 6 modules in addons/ens_core/oca/
- specta (v14): 35+ modules in addons/ens_core/
- mecafric (v17): 86 OCA modules (shared)
- mecafric_water (v17): 86 OCA modules (shared)

**Validation**: Query modules for afrequip, verify partner_statement_report appears

---

### 2.2 — Logs Real-time Access

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/logs/route.ts`

**Task**: Stream last 100-1000 lines from `docker logs <slug>_odoo_1`

```typescript
export async function getClientLogs(slug: string, lines: number = 100): Promise<string[]> {
  // Execute: docker logs --tail {lines} {slug}_odoo_1
  // Parse and return as array
  
  // Fallback if Docker not running: return empty
}
```

**Routes**:
- `GET /api/clients/{slug}/logs?lines=100` → return log tail
- `GET /api/clients/{slug}/logs/stream` → WebSocket (Phase 4)

**Real test**:
```bash
curl http://localhost:3000/api/clients/afrequip/logs?lines=50
```

---

### 2.3 — Git Branches & Activity

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/branches/route.ts`

**Task**: Query GitHub API or local git for branch info

```typescript
export async function getClientBranches(slug: string): Promise<GitBranch[]> {
  // Read current_repo from versions.json (e.g., "ENSWORK/pacadev-client-afrequip")
  // OR use core repo if client is part of monorepo
  
  // Fetch from GitHub API:
  // - Branch name
  // - Last author & commit date
  // - CI status (from GitHub Actions)
  // - Is protected?
  
  // For monorepo (afrequip): use ENSWORK/pacadev with branch prefix dev/afrequip/*
}
```

**Routes**:
- `GET /api/clients/{slug}/branches` → list branches
- `GET /api/clients/{slug}/branches/active` → current working branch

**Real data**:
- afrequip current_branch: `dev/afrequip/4-partner_statement_report`
- afrequip current_repo: `ENSWORK/pacadev`

**Requires**: GitHub token (read from secrets via `pacadev secrets show` or env var)

---

### 2.4 — Health Checks & Validation

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/validate/route.ts`

**Task**: Run diagnostic checks on each client

```typescript
export async function validateClient(slug: string): Promise<HealthCheck> {
  return {
    docker_running: await isDockerContainerRunning(`${slug}_odoo_1`),
    db_accessible: await testDatabaseConnection(slug),
    filestore_readable: fs.existsSync(`v{V}/clients/${slug}/filestore`),
    config_valid: fs.existsSync(`v{V}/clients/${slug}/config/odoo.conf`),
    odoo_responding: await testHTTPHealth(`http://localhost:PORT/web/health`),
    last_check: new Date().toISOString(),
  };
}
```

**Routes**:
- `GET /api/clients/{slug}/validate` → return health check result

**Real test**:
```bash
curl http://localhost:3000/api/clients/afrequip/validate
```

---

### Phase 2 Deliverables

| Endpoint | Status | Mock → Real |
|----------|--------|------------|
| `GET /api/clients/{slug}/modules` | 📝 Draft | Replace mockModules |
| `GET /api/clients/{slug}/logs` | 📝 Draft | Docker logs → real |
| `GET /api/clients/{slug}/branches` | 📝 Draft | GitHub API → real |
| `GET /api/clients/{slug}/validate` | 📝 Draft | Health checks → real |

---

## 🔒 PHASE 3 — Actions & State Changes (3-4 days)

### Critical: Security Layer First

⚠️ **Before implementing any action routes**, add:

```typescript
// src/lib/action-guard.ts
export function validateActionPermission(user: string, action: string, resource: string, context: any) {
  // Read RBAC from ~/.pacadev/rbac.json
  // Check: user role → action → resource
  // Log to audit-log.jsonl for every action
  // Return: { allowed: boolean, reason?: string }
}

export async function auditLog(action: string, user: string, client: string, details: any) {
  // Append to ~/.pacadev/state/audit-log.jsonl
  // Include: timestamp, action, user, client, details, hash, prev_hash
  // Preserve hash-chain integrity
}
```

### 3.1 — Work Session Control

**File**: `src/lib/pacadev-service.ts` + `src/app/api/work/start/route.ts`

**Task**: Wrapper around `pacadev work start`

```typescript
export async function startWork(client: string, issue: number, module?: string): Promise<WorkSession> {
  // Execute: pacadev work start --client {client} --issue {issue} [--module {module}]
  // Capture output: branch name, git commit hash
  // Log to audit
  // Return: session ID, branch, commit hash
}
```

**Routes**:
- `POST /api/work/start` → start new work session
- `POST /api/work/stop` → end session
- `GET /api/work/status` → current session

**Permissions**: Dev role or higher

---

### 3.2 — Deploy Approval & Execution

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/deploy/approval/route.ts`

**Task**: Gate-keeper for deployments

```typescript
export async function approveDeployment(client: string, environment: string, reason: string): Promise<Deployment> {
  // Validate: user role is 'lead' or 'admin'
  // Backup DB first
  // Execute: pacadev deploy approve --client {client} --env {environment}
  // Wait for completion (timeout: 30 min)
  // Return: deployment record with status
}
```

**Routes**:
- `POST /api/clients/{slug}/deploy/approval` → approve & execute deploy
- `GET /api/clients/{slug}/deploy/status` → deployment status

**Permissions**: Lead or Admin only

---

### 3.3 — Rollback Control

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/rollback/route.ts`

**Task**: Emergency rollback to previous backup

```typescript
export async function rollback(client: string, backupId?: string): Promise<RollbackResult> {
  // If no backupId: use most recent
  // Execute: pacadev rollback --client {client} [--backup {backupId}]
  // Monitor: health checks post-rollback
  // Log: who triggered, reason, result
}
```

**Routes**:
- `POST /api/clients/{slug}/rollback` → execute rollback
- `GET /api/clients/{slug}/rollback/dry-run` → preview what would be restored

**Permissions**: Admin only

---

### 3.4 — Backup Management

**File**: `src/lib/pacadev-service.ts` + `src/app/api/clients/[slug]/backups/route.ts`

**Task**: Create manual backups and verify integrity

```typescript
export async function createBackup(client: string): Promise<Backup> {
  // Execute: pacadev backup create --client {client}
  // Wait for completion
  // Return: backup record with checksum, size, timestamp
}

export async function verifyBackup(backupId: string): Promise<{ ok: boolean; checksum: string }> {
  // Recalculate checksum
  // Compare against stored value
}
```

**Routes**:
- `POST /api/clients/{slug}/backups` → create backup
- `GET /api/clients/{slug}/backups` → list backups
- `POST /api/clients/{slug}/backups/{id}/verify` → verify integrity

**Permissions**: Admin only

---

### Phase 3 Deliverables

| Action | Endpoint | CLI Wrapper | Audit |
|--------|----------|-------------|-------|
| Start work | `POST /api/work/start` | pacadev work start | ✅ |
| Deploy | `POST /api/clients/{slug}/deploy/approval` | pacadev deploy approve | ✅ |
| Rollback | `POST /api/clients/{slug}/rollback` | pacadev rollback | ✅ |
| Backup | `POST /api/clients/{slug}/backups` | pacadev backup create | ✅ |

---

## 📡 PHASE 4 — Real-time Observability (2-3 days)

### 4.1 — WebSocket for Log Streaming

**File**: `src/app/api/ws/logs/[slug]/route.ts` (or middleware)

**Task**: Stream logs in real-time via WebSocket

```typescript
// When client connects: ws://localhost:3000/ws/logs/afrequip
// Every 2 seconds: fetch new lines from docker logs
// Send delta (only new lines) to client
// On disconnect: cleanup
```

---

### 4.2 — Metrics Polling

**File**: `src/app/api/clients/[slug]/metrics/route.ts`

**Task**: Return Docker stats (CPU, RAM, network)

```typescript
export async function getClientMetrics(slug: string): Promise<Metrics> {
  // Execute: docker stats --no-stream {slug}_odoo_1 --format "json"
  // Parse: CPU %, Memory MB, Net I/O, Block I/O
  // Return with timestamp
}
```

**Routes**:
- `GET /api/clients/{slug}/metrics` → current stats
- Frontend polls every 5 seconds

---

### 4.3 — Pipeline Live Status

**File**: `src/app/api/clients/[slug]/pipeline/route.ts`

**Task**: Poll GitHub Actions for latest run

```typescript
export async function getPipelineStatus(slug: string): Promise<Pipeline> {
  // Fetch from GitHub API: latest workflow run for client's repo
  // Extract: lint, tests, security, AI risk, deploy status
  // Return live progress
}
```

---

### Phase 4 Deliverables

| Feature | Endpoint | Transport | Frequency |
|---------|----------|-----------|-----------|
| Log streaming | `WS /ws/logs/{slug}` | WebSocket | Real-time (2s) |
| Metrics | `GET /api/clients/{slug}/metrics` | REST poll | 5s |
| Pipeline status | `GET /api/clients/{slug}/pipeline` | REST poll | 5s |

---

## 📋 Implementation Checklist

### Prerequisites
- [ ] GitHub token configured (for branch/pipeline queries)
- [ ] Docker daemon accessible from Node.js process
- [ ] PACADEV CLI in PATH or path known
- [ ] Permissions set correctly on ~/.pacadev/ (readable by web UI)

### Phase 2 (Modules/Logs/Branches/Health)
- [ ] Implement `getClientModules(slug)` 
- [ ] Implement `getClientLogs(slug, lines)`
- [ ] Implement `getClientBranches(slug)`
- [ ] Implement `validateClient(slug)`
- [ ] Test each function with real afrequip, specta clients
- [ ] Update 4 API routes
- [ ] Verify mock data no longer used (delete from mock-data.ts if unused)

### Phase 3 (Actions)
- [ ] Add `validateActionPermission()` guard
- [ ] Add `auditLog()` append function
- [ ] Implement `startWork()` wrapper
- [ ] Implement `approveDeployment()` wrapper
- [ ] Implement `rollback()` wrapper
- [ ] Implement `createBackup()` wrapper
- [ ] Test each action with dry-run first
- [ ] Audit log verification (append format correct)

### Phase 4 (Real-time)
- [ ] Set up WebSocket handler for logs
- [ ] Implement `getClientMetrics()`
- [ ] Implement `getPipelineStatus()`
- [ ] Frontend subscribes to WebSocket (UI update needed)
- [ ] Polling intervals optimized (avoid thrashing)

---

## 🚀 Running Order

**Week 1**:
1. Phase 2.1 — Modules (1 day)
2. Phase 2.2 — Logs (0.5 day)
3. Phase 2.3 — Branches (1 day, needs GitHub token)
4. Phase 2.4 — Health checks (0.5 day)
5. **Test all 4 modules together** (0.5 day)

**Week 2**:
1. Phase 3 — Security layer first (1 day)
2. Phase 3.1 — Work control (1 day, dry-run only)
3. Phase 3.2 — Deploy approval (1 day, dry-run only)
4. Phase 3.3 — Rollback (0.5 day, dry-run only)
5. Phase 3.4 — Backup (0.5 day)
6. **Test all 4 actions with audit trail** (1 day)

**Week 3**:
1. Phase 4.1 — WebSocket logs (1 day)
2. Phase 4.2 — Metrics (0.5 day)
3. Phase 4.3 — Pipeline (1 day)
4. Frontend UI updates for real-time (1.5 day)
5. **End-to-end testing** (1 day)

---

## ⚙️ Environment Setup

### Required
```bash
# Check Docker access
docker ps --filter "name=afrequip"

# Check PACADEV paths
ls ~/.pacadev/state/
ls ~/pacadev/v17/clients/afrequip/

# Set GitHub token (for Phase 2.3 / Phase 4.3)
export GITHUB_TOKEN=ghp_xxxxx
```

### Optional
```bash
# Monitor logs during testing
tail -f ~/.pacadev/logs/web-ui.log
tail -f ~/.pacadev/state/audit-log.jsonl
```

---

## 📞 Blockers & Decisions

| Issue | Status | Decision Needed |
|-------|--------|-----------------|
| GitHub token rotation | ⚠️ Flagged | Use `pacadev secrets show` or hardcode? |
| Docker access from Node.js | 🔄 TBD | Assume docker CLI available? |
| Performance: Module scanning | 🔄 TBD | Cache results or scan on-demand? |
| Audit log append safety | ✅ OK | Use fs.appendFileSync with lock? |

---

## 📎 Related Files

- Main service: `src/lib/pacadev-service.ts` (will grow to 500+ lines)
- Guard service: `src/lib/action-guard.ts` (new, 200 lines)
- API routes: `src/app/api/clients/[slug]/*` (8 routes to update)
- Types: `src/lib/types.ts` (add GitBranch, HealthCheck, Metrics, Deployment)
- PACADEV source: `~/.pacadev/state/*` (read-only)

---

## ✍️ Sign-off

**Created**: 2026-05-15 11:30 UTC  
**Web UI Status**: Connected to PACADEV baseline ✅  
**Next Phase**: Ready to begin Phase 2  
**Last Updated**: [auto-updated on each phase completion]

