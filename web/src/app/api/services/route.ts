import { NextResponse } from 'next/server';
import { getRealServices } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  const services = getRealServices();

  const response: APIResponse<typeof services> = {
    success: true,
    data: services,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      total: services.length,
      up: services.filter(s => s.status === 'up').length,
      cli_equivalent: 'docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    },
  };

  return NextResponse.json(response);
}
