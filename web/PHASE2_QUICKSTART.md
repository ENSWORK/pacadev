# 🔧 QUICK START — Phase 2 Implementation Guide

**For**: Developers starting Phase 2  
**Time**: ~3 weeks  
**Complexity**: Medium

---

## Day 1 Setup — Modules Discovery

### Task: Implement `getClientModules(slug)`

#### 1. Understand the File Structure
```bash
# Show actual directory structure for afrequip
ls -la ~/pacadev/v17/clients/afrequip/addons/
# Output should show: oca/, ens_core/

# Show OCA modules
ls ~/pacadev/v17/clients/afrequip/addons/oca/ | head -10

# Show EnsWork custom modules
ls ~/pacadev/v17/clients/afrequip/addons/ens_core/
# Should show: partner_statement_report, etc.
```

#### 2. Read a Sample __manifest__.py
```bash
cat ~/pacadev/v17/clients/afrequip/addons/ens_core/partner_statement_report/__manifest__.py
```

Expected format:
```python
{
    'name': 'Partner Statement Report',
    'version': '17.0.1.0.0',
    'category': 'Technical',
    'author': 'ENSWORK',
    'license': 'AGPL-3',
    'depends': ['sale', 'account'],
    'data': [
        'security/ir.model.access.csv',
        'views/partner_views.xml',
    ],
    'installable': True,
}
```

#### 3. Add Function to `pacadev-service.ts`

Template:
```typescript
import fs from 'fs';
import path from 'path';

export function getClientModules(slug: string): ClientModule[] {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  
  if (!client) return [];
  
  const modules: ClientModule[] = [];
  const odooVersion = client.odoo_version;
  const basePath = path.join(PACADEV_WORKSPACE, `v${odooVersion}/clients/${slug}/addons`);
  
  // Scan both OCA and EnsWork directories
  for (const source of ['oca', 'ens_core']) {
    const sourcePath = path.join(basePath, source);
    
    if (!fs.existsSync(sourcePath)) continue;
    
    const moduleNames = fs.readdirSync(sourcePath);
    
    for (const moduleName of moduleNames) {
      const manifestPath = path.join(sourcePath, moduleName, '__manifest__.py');
      
      if (!fs.existsSync(manifestPath)) continue;
      
      try {
        // Parse __manifest__.py
        const content = fs.readFileSync(manifestPath, 'utf-8');
        // Extract: name, version from Python dict
        // (Simple regex or full Python parser - you choose)
        
        modules.push({
          id: `mod_${slug}_${moduleName}`,
          clientId: `cl_${slug}`,
          name: moduleName,
          version: extractVersion(content) || '?',
          source: source as ModuleSource,
          status: 'installed',
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Failed to parse ${moduleName}: ${err}`);
      }
    }
  }
  
  return modules.sort((a, b) => a.source.localeCompare(b.source));
}

function extractVersion(content: string): string | null {
  // Regex to extract 'version': 'X.Y.Z'
  const match = content.match(/'version':\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}
```

#### 4. Create Route File

Create: `src/app/api/clients/[slug]/modules/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getClientModules } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const modules = getClientModules(slug);

    const response: APIResponse<typeof modules> = {
      success: true,
      data: modules,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev module list --client ${slug}`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to list modules: ${error}`],
      },
      { status: 500 }
    );
  }
}
```

#### 5. Test
```bash
curl http://localhost:3000/api/clients/afrequip/modules | python3 -m json.tool | head -40
```

Expected output:
```json
{
  "success": true,
  "data": [
    {
      "id": "mod_afrequip_partner_statement_report",
      "clientId": "cl_afrequip",
      "name": "partner_statement_report",
      "version": "17.0.1.0.0",
      "source": "ens_core",
      "status": "installed",
      "lastUpdated": "..."
    }
  ]
}
```

---

## Day 2-3 — Logs Access

### Task: Implement `getClientLogs(slug, lines)`

#### 1. Test Docker Command
```bash
# List containers for afrequip
docker ps --filter "name=afrequip" --format "table {{.Names}}\t{{.Status}}"

# Get logs (if running)
docker logs --tail 50 afrequip_odoo_1 2>/dev/null || echo "Container not running"
```

#### 2. Add Function to `pacadev-service.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getClientLogs(slug: string, lines: number = 100): Promise<string[]> {
  const maxLines = Math.min(lines, 1000); // Cap at 1000
  
  try {
    const { stdout } = await execAsync(`docker logs --tail ${maxLines} ${slug}_odoo_1 2>&1`);
    return stdout.split('\n').filter(l => l.trim()).reverse(); // Newest first
  } catch (err) {
    console.error(`Failed to get logs for ${slug}: ${err}`);
    return []; // Return empty if Docker not running
  }
}
```

#### 3. Create Route

Create: `src/app/api/clients/[slug]/logs/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getClientLogs } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const lines = Math.min(parseInt(searchParams.get('lines') || '100'), 1000);
    
    const logs = await getClientLogs(slug, lines);

    const response: APIResponse<{ logs: string[]; count: number }> = {
      success: true,
      data: { logs, count: logs.length },
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `docker logs --tail ${lines} ${slug}_odoo_1`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to fetch logs: ${error}`],
      },
      { status: 500 }
    );
  }
}
```

#### 4. Test
```bash
# If afrequip container is running:
curl "http://localhost:3000/api/clients/afrequip/logs?lines=50" | python3 -m json.tool | head -30

# If not running:
# Should return empty array gracefully
```

---

## Day 4-5 — Git Branches

### Prerequisites
```bash
# Set GitHub token (replace with real token)
export GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE

# Verify token works
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/ENSWORK/pacadev/branches | python3 -m json.tool | head -20
```

### Task: Implement `getClientBranches(slug)`

```typescript
export async function getClientBranches(slug: string): Promise<GitBranch[]> {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  
  if (!client) return [];
  
  const repoFull = client.current_repo || 'ENSWORK/pacadev';
  const [owner, repo] = repoFull.split('/');
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set, branches unavailable');
    return [];
  }
  
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: { Authorization: `token ${token}` },
    });
    
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    
    const branches = await res.json();
    
    return branches.map((b: any) => ({
      name: b.name,
      author: b.commit.author?.name || 'Unknown',
      date: b.commit.author?.date || new Date().toISOString(),
      status: 'synced' as const, // TODO: compare with local
      ciStatus: 'pending' as const, // TODO: fetch from Actions
      isProtected: b.protected,
    }));
  } catch (err) {
    console.error(`Failed to fetch branches for ${slug}: ${err}`);
    return [];
  }
}
```

---

## Day 6 — Health Checks

### Task: Implement `validateClient(slug)`

```typescript
export async function validateClient(slug: string): Promise<any> {
  const versions = readVersionsJSON();
  const client = versions.clients[slug];
  
  if (!client) {
    return { success: false, reason: 'Client not found' };
  }
  
  const checks = {
    docker_running: await checkDocker(slug),
    db_accessible: await checkDatabase(slug), // TODO
    filestore_readable: checkFilestore(slug),
    config_valid: checkConfig(slug),
    odoo_responding: await checkHTTPHealth(slug), // TODO
    last_check: new Date().toISOString(),
  };
  
  return {
    success: Object.values(checks).filter(v => typeof v === 'boolean').every(v => v),
    checks,
  };
}

async function checkDocker(slug: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=${slug}_odoo_1" --format "{{.ID}}"`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function checkFilestore(slug: string): boolean {
  const versions = readVersionsJSON();
  const odooVersion = versions.clients[slug]?.odoo_version;
  const path_fs = path.join(PACADEV_WORKSPACE, `v${odooVersion}/clients/${slug}/filestore`);
  return fs.existsSync(path_fs);
}

function checkConfig(slug: string): boolean {
  const versions = readVersionsJSON();
  const odooVersion = versions.clients[slug]?.odoo_version;
  const path_conf = path.join(PACADEV_WORKSPACE, `v${odooVersion}/clients/${slug}/config/odoo.conf`);
  return fs.existsSync(path_conf);
}
```

---

## Useful Commands for Testing

```bash
# Watch real audit log changes
tail -f ~/.pacadev/state/audit-log.jsonl | jq '.'

# Watch web server logs
tail -f ~/pacadev/web/dev.log

# Check Turbopack hot reload status
# (Look for "✓ Ready" message in dev.log)

# Test all Phase 2 routes at once
for slug in afrequip specta mecafric; do
  echo "=== $slug ===" 
  curl -s http://localhost:3000/api/clients/$slug/modules | jq '.data | length'
  curl -s http://localhost:3000/api/clients/$slug/logs | jq '.data.count'
  curl -s http://localhost:3000/api/clients/$slug/validate | jq '.data.checks'
done
```

---

## Checklist Before Phase 3

- [ ] All Phase 2 modules use real PACADEV data (no mock)
- [ ] 4 new routes implemented (modules, logs, branches, validate)
- [ ] Each tested with afrequip, specta, mecafric
- [ ] Error handling for missing/stopped containers
- [ ] Response times < 1 second
- [ ] Audit log remains untouched (read-only Phase 2)

---

## Need Help?

- **"Where's the module?"** → Check: `~/pacadev/v{VERSION}/clients/{slug}/addons/`
- **"Docker logs empty?"** → Container might not be running. Check: `docker ps`
- **"Branches returning empty?"** → GitHub token might be missing. Set: `export GITHUB_TOKEN=...`
- **"Performance slow?"** → Might need caching. Add: `cache: { ...data, expiry: Date.now() + 30000 }`

