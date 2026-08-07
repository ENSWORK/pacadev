import { NextResponse } from 'next/server';
import { readAIConfig, writeAIConfig } from '@/lib/pacadev-service';
import type { APIResponse, AIConfig } from '@/lib/types';

export async function GET() {
  const data = readAIConfig();

  const response: APIResponse<AIConfig> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'pacadev ai config show',
    },
  };

  return NextResponse.json(response);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Merge the body with the persisted config (real, fichier état)
  const updatedConfig = writeAIConfig(body);

  const response: APIResponse<AIConfig> = {
    success: true,
    data: updatedConfig,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      cli_equivalent: 'pacadev ai config update',
    },
  };

  return NextResponse.json(response);
}
