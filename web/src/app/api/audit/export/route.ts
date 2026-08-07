import { NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'csv';
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

  if (format === 'csv') {
    const headers = 'id,user,action,client,details,reason,createdAt';
    const rows = logs.map(
      (l) =>
        `${l.id},"${l.user}","${l.action}","${l.client ?? ''}","${(l.details ?? '').replace(/"/g, '""')}","${(l.reason ?? '').replace(/"/g, '""')}","${l.createdAt}"`
    );
    const csv = [headers, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="audit-logs.csv"',
      },
    });
  }

  // JSON format
  const response: APIResponse<typeof logs> = {
    success: true,
    data: logs,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: `pacadev audit export --format ${format}`,
    },
  };

  return NextResponse.json(response);
}
