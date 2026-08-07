import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientVersions } from '@/lib/pacadev-service';
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev client versions ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const versions = getClientVersions(slug);

  const response: APIResponse<typeof versions> = {
    success: true,
    data: versions,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev client versions ${slug}`,
    },
  };

  return NextResponse.json(response);
}
