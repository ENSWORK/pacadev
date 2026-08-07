import { NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const logs = readAuditLog();

  const data = {
    logs,
    total: logs.length,
    source: 'real',
    auditFile: '/home/pacadev/.pacadev/state/audit-log.jsonl',
    connectionInfo: {
      type: 'polling',
      interval: '5s',
      wsEndpoint: 'ws://ws.pacadev.local',
    },
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'tail -f ~/.pacadev/state/audit-log.jsonl',
    },
  };

  return NextResponse.json(response);
}
