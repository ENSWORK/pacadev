import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getSecurityScan } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const client = searchParams.get('client');

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Paramètre requis manquant: client (slug)'],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: 'pacadev security scan --client <slug>' },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const clientData = getClientFromPACAPDEV(client);
  if (!clientData) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${client}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev security scan --client ${client}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const scan = getSecurityScan(client);

  const response: APIResponse<typeof scan> = {
    success: true,
    data: scan,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client,
      source: scan ? 'github_actions_ci' : 'unavailable',
      cli_equivalent: `pacadev security scan --client ${client}`,
    },
  };

  return NextResponse.json(response);
}
