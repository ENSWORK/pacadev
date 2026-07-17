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
        cli_equivalent: `pacadev gate approve --client ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { environment, reason, approved } = body as {
    environment?: string;
    reason?: string;
    approved?: boolean;
  };

  if (!environment) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required field: environment'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev gate approve --client ${slug} --env ${environment ?? ''}`,
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    gateAction: approved ? 'approved' : 'rejected',
    clientId: client.id,
    environment,
    reason: reason ?? '',
    approvedBy: 'admin@enswork.com',
    message: approved
      ? `Gate approved for ${environment} deployment on client ${slug}`
      : `Gate rejected for ${environment} deployment on client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev gate ${approved ? 'approve' : 'reject'} --client ${slug} --env ${environment}`,
    },
  };

  return NextResponse.json(response);
}
