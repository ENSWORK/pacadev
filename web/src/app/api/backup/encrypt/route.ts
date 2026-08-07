import { NextResponse } from 'next/server';
import { mockBackupSecurityInfo } from '@/lib/mock-data';
import type { APIResponse } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { enabled, clientSlug } = body;

  if (typeof enabled !== 'boolean') {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required field: enabled (boolean)'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev backup encrypt',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    previousState: mockBackupSecurityInfo.encryptionEnabled,
    newState: enabled,
    encryptionKeyId: enabled ? mockBackupSecurityInfo.encryptionKeyId : null,
    checksumPostEncryption: enabled ? 'sha256:encrypted_abc123' : null,
    message: enabled
      ? 'Chiffrement SOPS activé avec succès'
      : 'Chiffrement SOPS désactivé',
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: clientSlug || undefined,
      cli_equivalent: `pacadev backup encrypt ${enabled ? '--enable' : '--disable'}${clientSlug ? ` --client ${clientSlug}` : ''}`,
    },
  };

  return NextResponse.json(response);
}
