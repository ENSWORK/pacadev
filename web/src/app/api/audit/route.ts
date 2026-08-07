import { NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user');
    const client = searchParams.get('client');
    const action = searchParams.get('action');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let logs = readAuditLog();

    if (user) {
      logs = logs.filter((l) => l.user === user);
    }
    if (client) {
      logs = logs.filter((l) => l.client === client);
    }
    if (action) {
      logs = logs.filter((l) => l.action === action);
    }
    if (from) {
      const fromDate = new Date(from);
      logs = logs.filter((l) => new Date(l.createdAt) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      logs = logs.filter((l) => new Date(l.createdAt) <= toDate);
    }

    const response: APIResponse<typeof logs> = {
      success: true,
      data: logs,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev audit${user ? ` --user ${user}` : ''}${client ? ` --client ${client}` : ''}${action ? ` --action ${action}` : ''}`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to load audit logs: ${error}`],
      },
      { status: 500 }
    );
  }
}
