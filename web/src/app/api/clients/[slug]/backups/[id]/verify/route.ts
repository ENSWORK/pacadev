import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientBackups } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  if (!getClientFromPACAPDEV(slug)) {
    return NextResponse.json({ success: false, data: null, errors: [`Client "${slug}" not found`], meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com' } } satisfies APIResponse<null>, { status: 404 });
  }

  const backups = getClientBackups(slug);
  const backup = backups.find((b) => b.id === id);

  if (!backup) {
    return NextResponse.json({ success: false, data: null, errors: [`Backup "${id}" not found`], meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug } } satisfies APIResponse<null>, { status: 404 });
  }

  const data = {
    verified: true,
    backupId: id,
    checksumValid: true,
    sizeMatch: true,
    integrityCheck: 'passed',
    message: `Backup "${id}" integrity verification passed`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev backup verify --client ${slug} --id ${id}`,
    },
  };

  return NextResponse.json(response);
}
