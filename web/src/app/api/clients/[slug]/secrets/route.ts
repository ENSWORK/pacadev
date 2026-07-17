import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

// Mock secrets data per client
const mockSecrets: Record<string, Record<string, string>> = {
  acmecorp: {
    DB_HOST: '***',
    DB_PASSWORD: '********',
    ODOO_MASTER_PASS: '************',
    SMTP_PASSWORD: '********',
    API_KEY_STRIPE: 'sk_*********************',
  },
  globex: {
    DB_HOST: '***',
    DB_PASSWORD: '********',
    ODOO_MASTER_PASS: '************',
    SMTP_PASSWORD: '********',
  },
  initech: {
    DB_HOST: '***',
    DB_PASSWORD: '********',
    ODOO_MASTER_PASS: '************',
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev secrets show ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const secrets = mockSecrets[slug] ?? {};
  const secretKeys = Object.keys(secrets);

  const data = {
    client: slug,
    keys: secretKeys,
    masked: true,
    count: secretKeys.length,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev secrets show ${slug}`,
    },
  };

  return NextResponse.json(response);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev secrets init ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const data = {
    initialized: true,
    client: slug,
    message: `Secrets vault initialized for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev secrets init ${slug}`,
    },
  };

  return NextResponse.json(response);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev secrets edit ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { key, value } = body as { key?: string; value?: string };

  if (!key || !value) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required fields: key, value'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev secrets edit ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = {
    updated: true,
    client: slug,
    key,
    previousValue: '********',
    message: `Secret "${key}" updated for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev secrets edit ${slug}`,
    },
  };

  return NextResponse.json(response);
}
