import { NextResponse } from 'next/server';
import { getClientsFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET() {
  try {
    const clients = getClientsFromPACAPDEV();

    const response: APIResponse<typeof clients> = {
      success: true,
      data: clients,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev client list',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to load clients: ${error}`],
      },
      { status: 500 }
    );
  }
}
