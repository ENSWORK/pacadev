import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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
          cli_equivalent: `pacadev client show ${slug}`,
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: APIResponse<typeof client> = {
      success: true,
      data: client,
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev client show ${slug}`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        errors: [`Failed to load client: ${error}`],
      },
      { status: 500 }
    );
  }
}
