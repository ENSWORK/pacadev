import { NextResponse } from 'next/server';
import { isValidSessionToken, readGateCookie } from '@/lib/operations/gate';
import { loadOperations } from '@/lib/operations/service';
import { ProjectionError } from '@/lib/operations/normalize';

// Cockpit operations - lecture seule. Aucun export POST/PUT/PATCH/DELETE ici.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const password = process.env.OPERATIONS_TASKS_PASSWORD;
  if (!password) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [
          'Cockpit verrouillé : OPERATIONS_TASKS_PASSWORD absent du serveur. Aucune ouverture par défaut.',
        ],
      },
      { status: 503, headers: NO_STORE }
    );
  }

  const token = readGateCookie(request.headers.get('cookie'));
  if (!isValidSessionToken(token, password)) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: ['Session absente ou expirée : saisissez le mot de passe du cockpit.'],
      },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    const { payload, sourceName, fallbackDetail } = await loadOperations();
    return NextResponse.json(
      {
        success: true,
        data: payload,
        meta: {
          timestamp: new Date().toISOString(),
          user: 'cockpit-operations',
          source: sourceName,
          read_only: true,
          clickup_parity: 'indisponible',
          ...(fallbackDetail ? { warning: fallbackDetail } : {}),
        },
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    const message =
      error instanceof ProjectionError
        ? error.message
        : `Lecture des tâches impossible : ${(error as Error).message}`;
    return NextResponse.json(
      { success: false, data: null, errors: [message] },
      { status: 500, headers: NO_STORE }
    );
  }
}
