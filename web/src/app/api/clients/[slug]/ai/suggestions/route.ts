import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV } from '@/lib/pacadev-service';
import type { APIResponse, AISuggestion } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    return NextResponse.json({
      success: false, data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com' },
    } satisfies APIResponse<null>, { status: 404 });
  }

  // No AI suggestion engine yet — return empty list
  const suggestions: AISuggestion[] = [];

  return NextResponse.json({
    success: true,
    data: suggestions,
    meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev ai suggest --client ${slug}` },
  } satisfies APIResponse<AISuggestion[]>);
}
