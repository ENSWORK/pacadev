import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, rollbackClient } from '@/lib/pacadev-service';
import { guardAction, auditAction } from '@/lib/action-guard';
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
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev rollback run --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const guard = guardAction('rollback', slug);
  auditAction(guard);
  if (!guard.allowed) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: guard.reasons,
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev rollback run --client ${slug} --backup <ID>` },
    };
    return NextResponse.json(response, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { backupId, dryRun = true } = body as { backupId?: string; dryRun?: boolean };

  if (!backupId) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Champ requis manquant: backupId'],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev rollback run --client ${slug} --backup <ID>` },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = rollbackClient(slug, backupId, dryRun);

  const response: APIResponse<typeof data> = {
    success: data.success,
    data,
    errors: data.success ? [] : [data.message],
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev rollback run --client ${slug} --backup ${backupId}${dryRun ? ' --dry-run' : ''}`,
    },
  };

  return NextResponse.json(response);
}
