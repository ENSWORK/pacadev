import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev deploy --client ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { environment, reason } = body as { environment?: string; reason?: string };

  if (!environment) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required field: environment'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev deploy --client ${slug} --env ${environment ?? ''}`,
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    deploymentTriggered: true,
    clientId: client.id,
    environment,
    reason: reason ?? 'Manual trigger',
    gateRequired: environment === 'prod',
    gateStatus: environment === 'prod' ? 'pending_approval' : 'auto_approved',
    message:
      environment === 'prod'
        ? `Deployment to production requires gate approval for client ${slug}`
        : `Deployment to ${environment} triggered automatically for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev deploy --client ${slug} --env ${environment}`,
    },
  };

  return NextResponse.json(response);
}
