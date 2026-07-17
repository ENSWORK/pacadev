import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientPipeline } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev pipeline --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  const runs = getClientPipeline(slug, limit);

  const response: APIResponse<typeof runs> = {
    success: true,
    data: runs,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `gh run list --repo ENSWORK/pacadev --limit ${limit} # ${runs.length} runs`,
    },
  };

  return NextResponse.json(response);
}
