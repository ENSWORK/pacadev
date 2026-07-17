import { NextResponse } from 'next/server';
import { mockAIConfig } from '@/lib/mock-data';
import type { APIResponse, AIConfig } from '@/lib/types';

export async function GET() {
  const response: APIResponse<AIConfig> = {
    success: true,
    data: mockAIConfig,
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

  // Merge the body with the mock config (simulating an update)
  const updatedConfig: AIConfig = {
    ...mockAIConfig,
    ...(body as Partial<AIConfig>),
  };

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
