import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, workStop } from '@/lib/pacadev-service';
import { guardAction, auditAction } from '@/lib/action-guard';
import type { APIResponse } from '@/lib/types';

export async function POST(
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev work stop --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const guard = guardAction('work_start', slug);
  auditAction(guard);
  if (!guard.allowed) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: guard.reasons,
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev work stop --client ${slug}` },
    };
    return NextResponse.json(response, { status: 403 });
  }

  const data = workStop(slug);

  const response: APIResponse<typeof data> = {
    success: data.success,
    data,
    errors: data.success ? [] : [data.message],
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev work stop --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}
