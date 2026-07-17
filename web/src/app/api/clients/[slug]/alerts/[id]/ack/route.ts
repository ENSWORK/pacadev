import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev alerts ack --client ${slug} --id ${id}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const data = {
    acknowledged: true,
    alertId: id,
    newStatus: 'acknowledged',
    acknowledgedBy: 'admin@enswork.com',
    message: `Alert "${id}" acknowledged by admin@enswork.com`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev alerts ack --client ${slug} --id ${id}`,
    },
  };

  return NextResponse.json(response);
}
