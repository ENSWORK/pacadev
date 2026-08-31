import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// ============ ACTION GUARD — Phase 3 security layer ============

const PACADEV_HOME = process.env.PACADEV_HOME || path.join('/home/pacadev', '.pacadev');

export interface ActionUser {
  id: string;
  login: string;
  role: string;
  email: string;
  permissions: string[];
  clients: string[];
}

export interface GuardResult {
  allowed: boolean;
  role: string;
  action: string;
  client?: string;
  reasons: string[];
}

function readRBAC(): { roles: Record<string, { permissions: string[]; clients: string[] }>; user_roles: Record<string, string> } {
  const file = path.join(PACADEV_HOME, 'rbac.json');
  try {
    const data = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      roles: parsed.roles || {},
      user_roles: parsed.user_roles || {},
    };
  } catch {
    return { roles: {}, user_roles: {} };
  }
}

export function getCurrentUser(): ActionUser {
  const rbac = readRBAC();
  let login = 'pacadev';
  try {
    const res = spawnSync('whoami', [], { encoding: 'utf-8', timeout: 2000 });
    login = res.stdout?.trim() || login;
  } catch {
    // fallback login
  }

  const role = rbac.user_roles[login] || 'viewer';
  const perms = rbac.roles[role]?.permissions || [];
  const clients = rbac.roles[role]?.clients || [];

  return {
    id: `user_${login}`,
    login,
    role,
    email: 'dg.enswork@gmail.com',
    permissions: perms,
    clients,
  };
}

export function guardAction(action: string, client?: string): GuardResult {
  const user = getCurrentUser();
  const reasons: string[] = [];

  const hasAction = user.permissions.includes('*') || user.permissions.includes(action);
  if (!hasAction) {
    reasons.push(`Rôle "${user.role}" ne possède pas la permission "${action}"`);
  }

  const hasClient = user.clients.includes('*') || (client ? user.clients.includes(client) : false);
  if (client && !hasClient) {
    reasons.push(`Rôle "${user.role}" n'a pas accès au client "${client}"`);
  }

  return {
    allowed: reasons.length === 0,
    role: user.role,
    action,
    client,
    reasons,
  };
}

export function auditAction(result: GuardResult, details?: Record<string, unknown>) {
  try {
    const file = path.join(PACADEV_HOME, 'state', 'audit-log.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      user: getCurrentUser().login,
      action: result.action,
      client: result.client || '_global',
      allowed: result.allowed,
      reasons: result.reasons,
      details: details || {},
    };
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch {
    // audit logging is best-effort
  }
}
