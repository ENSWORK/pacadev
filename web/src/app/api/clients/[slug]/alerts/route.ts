import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientAlerts } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev alerts --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const alerts = getClientAlerts(slug);

  const response: APIResponse<typeof alerts> = {
    success: true,
    data: alerts,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      total: alerts.length,
      cli_equivalent: `pacadev alerts --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}
