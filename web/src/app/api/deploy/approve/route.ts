import { NextResponse } from 'next/server';
import type { APIResponse } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { clientSlug, deploymentId, reason, token } = body;

  if (!clientSlug || !deploymentId || !token) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required fields: clientSlug, deploymentId, token'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev deploy approve',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    approved: true,
    clientSlug,
    deploymentId,
    approvedBy: 'admin@enswork.com',
    approvedAt: new Date().toISOString(),
    reason: reason || null,
    tokenUsed: token.slice(0, 8) + '...',
    nextStep: 'Déploiement en cours de préparation',
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: clientSlug,
      cli_equivalent: `pacadev deploy approve --client ${clientSlug} --deployment ${deploymentId} --token ${token.slice(0, 4)}****`,
    },
  };

  return NextResponse.json(response);
}
