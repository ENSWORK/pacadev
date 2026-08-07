import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientIssues } from '@/lib/pacadev-service';
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `gh issue list --label client:${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state') || 'all';

  const issues = getClientIssues(slug, state);

  const response: APIResponse<typeof issues> = {
    success: true,
    data: issues,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      total: issues.length,
      cli_equivalent: `gh issue list --label client:${slug} --state ${state}`,
    },
  };

  return NextResponse.json(response);
}
