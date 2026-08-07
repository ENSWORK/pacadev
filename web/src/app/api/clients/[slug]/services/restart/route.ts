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
        cli_equivalent: `pacadev service restart --client ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { service } = body as { service?: string };

  if (!service) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required field: service'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev service restart --client ${slug} --service <service>`,
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    restarted: true,
    client: slug,
    service,
    previousStatus: 'unknown',
    newStatus: 'restarting' as const,
    message: `Service "${service}" restart initiated for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `docker restart ${slug}-${service}`,
    },
  };

  return NextResponse.json(response);
}
