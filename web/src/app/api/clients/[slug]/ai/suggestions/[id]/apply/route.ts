import { NextResponse } from 'next/server';
import { mockClients, mockSuggestions } from '@/lib/mock-data';
import type { APIResponse } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const client = mockClients.find((c) => c.slug === slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev ai apply --client ${slug} --suggestion ${id}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const suggestion = mockSuggestions.find((s) => s.id === id && s.clientId === client.id);

  if (!suggestion) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Suggestion "${id}" not found for client "${slug}"`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev ai apply --client ${slug} --suggestion ${id}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const data = {
    applied: true,
    suggestionId: id,
    clientId: client.id,
    type: suggestion.type,
    title: suggestion.title,
    appliedBy: 'admin@enswork.com',
    appliedAt: new Date().toISOString(),
    message: `Suggestion "${suggestion.title}" applied successfully for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev ai apply --client ${slug} --suggestion ${id}`,
    },
  };

  return NextResponse.json(response);
}
