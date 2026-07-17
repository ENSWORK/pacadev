import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getAIRiskFromPipeline } from '@/lib/pacadev-service';
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev ai risk --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const risk = getAIRiskFromPipeline(slug);

  const response: APIResponse<typeof risk> = {
    success: true,
    data: risk,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      source: risk ? 'github_actions_ci' : 'unavailable',
      cli_equivalent: `pacadev ai risk --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}
