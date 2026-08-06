import { NextResponse } from 'next/server';
import { getRealUser } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const user = getRealUser();
  const response: APIResponse<typeof user> = {
    success: true,
    data: user,
    meta: {
      timestamp: new Date().toISOString(),
      user: user.email,
      cli_equivalent: 'pacadev auth whoami',
    },
  };
  return NextResponse.json(response);
}
