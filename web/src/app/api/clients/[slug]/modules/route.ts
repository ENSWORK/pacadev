import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getClientModules } from '@/lib/pacadev-service';
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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev client modules ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const modules = getClientModules(slug);

  const response: APIResponse<typeof modules> = {
    success: true,
    data: modules,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      total: modules.length,
      cli_equivalent: `pacadev client modules ${slug}`,
    },
  };

  return NextResponse.json(response);
}
