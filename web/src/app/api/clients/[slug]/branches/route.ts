import { NextResponse } from 'next/server';
import { getClientBranches } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const branches = getClientBranches(slug);

  const response: APIResponse<typeof branches> = {
    success: true,
    data: branches,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `git -C /home/pacadev/pacadev branch -a`,
    },
  };
  return NextResponse.json(response);
}
