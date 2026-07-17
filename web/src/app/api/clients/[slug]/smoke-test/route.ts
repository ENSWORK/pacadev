import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    return NextResponse.json({ success: false, data: null, errors: [`Client "${slug}" not found`], meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com' } } satisfies APIResponse<null>, { status: 404 });
  }

  // Smoke tests not yet automated — return empty result set
  const data = {
    clientId: client.id,
    triggeredAt: new Date().toISOString(),
    triggeredBy: 'admin@enswork.com',
    totalTests: 0,
    passed: 0,
    failed: 0,
    results: [] as { name: string; status: string; duration: number }[],
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev smoke-test --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}
