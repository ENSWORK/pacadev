import { NextResponse } from 'next/server';
import type { APIResponse } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { clientSlug, type, moduleName, title, description, acceptanceCriteria, technicalImpact, priority } = body;

  if (!clientSlug || !type || !title || !priority) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Missing required fields: clientSlug, type, title, priority'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: 'pacadev ticket create',
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const ticketNumber = Math.floor(Math.random() * 900) + 100;
  const ticketId = `wt_${Date.now()}`;

  const ticket = {
    id: ticketId,
    number: ticketNumber,
    title,
    type,
    clientSlug,
    moduleName: moduleName || null,
    description: description || '',
    acceptanceCriteria: acceptanceCriteria || [],
    technicalImpact: technicalImpact || [],
    priority,
    assignee: null,
    status: 'open' as const,
    branchName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const response: APIResponse<typeof ticket> = {
    success: true,
    data: ticket,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: clientSlug,
      cli_equivalent: `pacadev ticket create --client ${clientSlug} --type ${type} --title "${title}" --priority ${priority}`,
    },
  };

  return NextResponse.json(response, { status: 201 });
}
