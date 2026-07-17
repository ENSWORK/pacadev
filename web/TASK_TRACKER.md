# ✅ TASK TRACKER — PACADEV Web UI Integration

**Last Updated**: 2026-05-15  
**Current Phase**: 2 (Ready to Start)

---

## PHASE 1 ✅ COMPLETE

### Service Layer
- [x] `src/lib/pacadev-service.ts` created
- [x] `readVersionsJSON()` implemented
- [x] `readAuditLog()` implemented  
- [x] `readConfigYAML()` implemented
- [x] `readRBACJSON()` implemented
- [x] `getClientsFromPACAPDEV()` implemented
- [x] `getClientFromPACAPDEV(slug)` implemented
- [x] `getDashboardStats()` implemented

### API Routes Updated
- [x] `GET /api/clients` → Uses `getClientsFromPACAPDEV()`
- [x] `GET /api/clients/{slug}` → Uses `getClientFromPACAPDEV(slug)`
- [x] `GET /api/dashboard` → Uses `getDashboardStats()`
- [x] `GET /api/audit` → Uses `readAuditLog()`

### Validation
- [x] All 4 routes return HTTP 200
- [x] Real clients appear (5 total: acmecorp, afrequip, specta, mecafric, mecafric_water)
- [x] Real audit log entries displayed (work_start, work_done, migration events)
- [x] Data types match TypeScript interfaces

---

## PHASE 2 🔄 READY TO START

### 2.1 Modules Discovery

**Function**: `getClientModules(slug: string): Promise<ClientModule[]>`

- [ ] Read v14/clients/{slug}/addons/oca/ manifest files
- [ ] Read v14/clients/{slug}/addons/ens_core/ manifest files
- [ ] Read v17/clients/{slug}/addons/oca/ manifest files
- [ ] Read v17/clients/{slug}/addons/ens_core/ manifest files
- [ ] Parse __manifest__.py for: name, version, author, category, license
- [ ] Determine status (installed/disabled/upgrade_available)
- [ ] Return sorted by source (OCA first, then custom)

**Route**: `GET /api/clients/{slug}/modules`
- [ ] Create route.ts file
- [ ] Add response wrapper with meta.cli_equivalent
- [ ] Error handling for missing client/directory

**Tests**:
- [ ] Query afrequip modules → should include partner_statement_report
- [ ] Query specta modules → should show 35+ from ens_core
- [ ] Query mecafric modules → should show 86 OCA modules

---

### 2.2 Logs Access

**Function**: `getClientLogs(slug: string, lines: number = 100): Promise<string[]>`

- [ ] Execute `docker logs --tail {lines} {slug}_odoo_1`
- [ ] Handle error if Docker not running (graceful fallback)
- [ ] Parse output into array (one line per element)
- [ ] Reverse order (newest first)

**Route**: `GET /api/clients/{slug}/logs?lines=100`
- [ ] Create route.ts file
- [ ] Parse query param `lines` (default 100, max 1000)
- [ ] Wrap response with timestamps

**Tests**:
- [ ] afrequip logs → should return 100 lines if container running
- [ ] specta logs → should return recent activity

---

### 2.3 Git Branches

**Function**: `getClientBranches(slug: string): Promise<GitBranch[]>`

- [ ] Read `current_repo` from versions.json for client
- [ ] Determine if monorepo (ENSWORK/pacadev) or per-client repo
- [ ] Query GitHub API: `GET /repos/{org}/{repo}/branches`
- [ ] For each branch, get: name, last commit author, date
- [ ] Query GitHub Actions: latest workflow run status
- [ ] Extract: CI status (success/failure/running/pending)
- [ ] Mark: is protected?

**Route**: `GET /api/clients/{slug}/branches`
- [ ] Create route.ts file
- [ ] Requires GITHUB_TOKEN env var (set or read from pacadev secrets)
- [ ] Cache results (30 sec) to avoid rate limiting
- [ ] Handle GitHub API errors gracefully

**Tests**:
- [ ] afrequip branches → should show `dev/afrequip/4-partner_statement_report` as current
- [ ] Branch detail → should show last author, date
- [ ] CI status → should show latest workflow result

---

### 2.4 Health Checks

**Function**: `validateClient(slug: string): Promise<HealthCheck>`

- [ ] Check `docker ps` for {slug}_odoo_1 container
- [ ] Test database connection (SQL query to Odoo DB)
- [ ] Check filestore exists and readable
- [ ] Verify config/odoo.conf exists
- [ ] HTTP health check to Odoo instance (if running)
- [ ] Return: { docker_running, db_accessible, filestore_readable, config_valid, odoo_responding, last_check }

**Route**: `GET /api/clients/{slug}/validate`
- [ ] Create route.ts file
- [ ] Return HealthCheck object
- [ ] Include timestamp

**Tests**:
- [ ] afrequip validate → should show which checks pass/fail
- [ ] Different status for stopped vs running container

---

### Phase 2 Completion Criteria
- [ ] All 4 functions implemented and tested
- [ ] All 4 routes return HTTP 200 with real data
- [ ] No more mock data used for these endpoints (can be deleted later)
- [ ] Edge cases handled (missing client, Docker not running, etc.)
- [ ] Performance acceptable (< 1 second response time)

---

## PHASE 3 🔴 BLOCKED (WAITING FOR PHASE 2)

### Security Layer (PREREQUISITE)

- [ ] Create `src/lib/action-guard.ts`
- [ ] Implement `validateActionPermission(user, action, resource, context)`
- [ ] Implement `auditLog(action, user, client, details)` 
- [ ] Test: audit entries append to ~/.pacadev/state/audit-log.jsonl
- [ ] Verify: hash-chain integrity preserved

---

### 3.1 Work Session Control

- [ ] Implement `startWork(client, issue, module?)`
- [ ] Implement `stopWork(client)`
- [ ] Implement `getWorkStatus(client)`
- [ ] Routes: POST /api/work/start, POST /api/work/stop, GET /api/work/status
- [ ] Permission: Dev+ only
- [ ] Dry-run mode (don't actually execute CLI)

---

### 3.2 Deploy Approval

- [ ] Implement `approveDeployment(client, environment, reason)`
- [ ] Create backup before deploy
- [ ] Monitor deployment (timeout 30 min)
- [ ] Route: POST /api/clients/{slug}/deploy/approval
- [ ] Permission: Lead+ only
- [ ] Dry-run mode

---

### 3.3 Rollback

- [ ] Implement `rollback(client, backupId?)`
- [ ] Route: POST /api/clients/{slug}/rollback
- [ ] Route: GET /api/clients/{slug}/rollback/dry-run
- [ ] Permission: Admin only
- [ ] Dry-run mode

---

### 3.4 Backup Management

- [ ] Implement `createBackup(client)`
- [ ] Implement `verifyBackup(backupId)`
- [ ] Routes: POST /api/clients/{slug}/backups, GET /api/clients/{slug}/backups, POST .../backups/{id}/verify
- [ ] Permission: Admin only

---

## PHASE 4 🟡 BLOCKED (WAITING FOR PHASE 3)

### 4.1 WebSocket Log Streaming

- [ ] Set up WebSocket handler
- [ ] Stream logs every 2 seconds
- [ ] Send delta (new lines only) to client
- [ ] Route: WS /ws/logs/{slug}

---

### 4.2 Metrics

- [ ] Implement `getClientMetrics(slug)`
- [ ] Route: GET /api/clients/{slug}/metrics
- [ ] Return: CPU %, memory, network I/O

---

### 4.3 Pipeline Live Status

- [ ] Implement `getPipelineStatus(slug)`
- [ ] Route: GET /api/clients/{slug}/pipeline
- [ ] Frontend polls every 5 seconds

---

## 🐛 Known Issues & Decisions

| Issue | Priority | Owner | Status |
|-------|----------|-------|--------|
| GitHub token management | 🟡 Medium | User | 🔄 TBD |
| Module scanning performance | 🟡 Medium | Dev | 🔄 TBD (cache?) |
| Docker accessibility from Node | 🟠 Medium | Env | ✅ OK |
| Audit log thread safety | 🟠 Medium | Dev | 🔄 TBD (lock?) |

---

## 📞 Quick Reference

### Files to Create/Modify

**Phase 2**:
- [ ] `src/lib/pacadev-service.ts` (add 4 functions)
- [ ] `src/app/api/clients/[slug]/modules/route.ts` (new)
- [ ] `src/app/api/clients/[slug]/logs/route.ts` (new)
- [ ] `src/app/api/clients/[slug]/branches/route.ts` (new, requires GitHub token setup)
- [ ] `src/app/api/clients/[slug]/validate/route.ts` (new)

**Phase 3**:
- [ ] `src/lib/action-guard.ts` (new)
- [ ] `src/app/api/work/start/route.ts` (new)
- [ ] `src/app/api/clients/[slug]/deploy/approval/route.ts` (new)
- [ ] `src/app/api/clients/[slug]/rollback/route.ts` (new)
- [ ] `src/app/api/clients/[slug]/backups/route.ts` (new)

**Phase 4**:
- [ ] WebSocket handler (path TBD)
- [ ] UI updates for real-time data

---

## 🚀 Next Steps

1. **Read INTEGRATION_ROADMAP.md** for detailed task descriptions
2. **Start Phase 2.1 (Modules)** — least risky, high value
3. **Test with real afrequip client**
4. **Each week: complete 1 phase, test thoroughly**

---

## 📈 Progress Bar

```
[████████░░░░░░░░░░░░░░] 33% Complete
Phase 1: ████████ ✅
Phase 2: ░░░░░░░░ 🔄 Ready
Phase 3: ░░░░░░░░ ⏳ Blocked
Phase 4: ░░░░░░░░ ⏳ Blocked
```

**ETA**: 3 weeks (with 30 hours work)

