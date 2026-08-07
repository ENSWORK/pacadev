import { NextResponse } from 'next/server';
import type { APIResponse } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { ticketId, clientSlug, cloneDb, modules, loadIaContext } = body;

  if (!ticketId || !clientSlug) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required fields: ticketId, clientSlug'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev work start',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const sessionId = `sess_${Date.now()}`;
  const now = new Date().toISOString();

  const session = {
    id: sessionId,
    ticketId,
    ticketNumber: parseInt(ticketId.replace('wt_', ''), 10) || 0,
    clientSlug,
    branchName: `dev/${clientSlug}/${ticketId.replace('wt_', '')}-work`,
    odooVersion: '17',
    startedAt: now,
    lastActivity: now,
    status: 'active' as const,
    config: {
      cloneDb: cloneDb ?? false,
      modules: modules ?? [],
      loadIaContext: loadIaContext ?? true,
    },
  };

  const response: APIResponse<typeof session> = {
    success: true,
    data: session,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: clientSlug,
      cli_equivalent: `pacadev work start --ticket ${ticketId} --client ${clientSlug}${cloneDb ? ' --clone-db' : ''}${loadIaContext === false ? ' --no-ia-context' : ''}`,
    },
  };

  return NextResponse.json(response, { status: 201 });
}
