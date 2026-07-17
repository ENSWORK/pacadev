import { NextResponse } from 'next/server';
import { getRealUser } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const user = getRealUser();
  const data = {
    user: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    githubLogin: user.githubLogin,
    sessionStart: user.sessionStart,
    expiresAt: user.expiresAt,
    remainingTime: Math.max(0, new Date(user.expiresAt).getTime() - Date.now()),
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: user.email,
      cli_equivalent: 'pacadev session info',
    },
  };
  return NextResponse.json(response);
}
