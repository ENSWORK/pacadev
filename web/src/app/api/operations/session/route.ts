import { NextResponse } from 'next/server';
import {
  GATE_MAX_AGE_SECONDS,
  gateCookieOptions,
  passwordMatches,
  sessionToken,
} from '@/lib/operations/gate';

// Ouverture (POST) et fermeture (DELETE) de la session du cockpit operations.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
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

  let candidate: unknown = null;
  try {
    const body = await request.json();
    candidate = (body as { password?: unknown } | null)?.password;
  } catch {
    candidate = null;
  }

  if (!passwordMatches(candidate, password)) {
    return NextResponse.json(
      { success: false, data: null, errors: ['Mot de passe incorrect.'] },
      { status: 401, headers: NO_STORE }
    );
  }

  const response = NextResponse.json(
    { success: true, data: { authenticated: true, expires_in: GATE_MAX_AGE_SECONDS } },
    { headers: NO_STORE }
  );
  response.cookies.set({ ...gateCookieOptions(), value: sessionToken(password) });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json(
    { success: true, data: { authenticated: false } },
    { headers: NO_STORE }
  );
  response.cookies.set({ ...gateCookieOptions(), value: '', maxAge: 0 });
  return response;
}
