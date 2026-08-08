import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { getClientFromPACAPDEV, getClientBackups } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com' },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const backup = getClientBackups(slug).find((b) => b.id === id);

  if (!backup || !backup.path || !existsSync(backup.path)) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Backup "${id}" non trouvé ou fichier indisponible sur le serveur`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev backup download --client ${slug} --id ${id}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const buffer = readFileSync(backup.path);
  const filename = backup.path.split('/').pop() ?? `${id}.tar.gz`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
