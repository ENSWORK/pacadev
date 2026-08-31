import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientBackups } from '@/lib/pacadev-service';
import { guardAction, auditAction } from '@/lib/action-guard';
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev backup list --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const backups = getClientBackups(slug);

  const response: APIResponse<typeof backups> = {
    success: true,
    data: backups,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      total: backups.length,
      cli_equivalent: `pacadev backup list --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}

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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev backup create --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const guard = guardAction('manage_backups', slug);
  auditAction(guard);
  if (!guard.allowed) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: guard.reasons,
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev backup create --client ${slug}` },
    };
    return NextResponse.json(response, { status: 403 });
  }

  const data = {
    backupTriggered: true,
    clientId: client.id,
    type: 'full',
    status: 'running',
    message: `Backup déclenché pour ${slug}`,
    cli_command: `pacadev backup create --client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev backup create --client ${slug}`,
    },
  };

  return NextResponse.json(response);
}
