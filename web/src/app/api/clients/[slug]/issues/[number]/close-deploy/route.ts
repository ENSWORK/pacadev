import { NextResponse } from 'next/server';
import { mockClients, mockTickets } from '@/lib/mock-data';
import type { APIResponse } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; number: string }> }
) {
  const { slug, number: issueNumber } = await params;
  const client = mockClients.find((c) => c.slug === slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client with slug "${slug}" not found`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        cli_equivalent: `pacadev issue close_deploy ${issueNumber} --client ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const issues = mockTickets[slug] ?? [];
  const issue = issues.find((t) => t.id === Number(issueNumber));

  if (!issue) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Issue #${issueNumber} not found for client "${slug}"`],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev issue close_deploy ${issueNumber} --client ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { env } = body as { env?: string };
  const environment = env ?? 'staging';

  const data = {
    id: issue.id,
    title: issue.title,
    status: 'closed',
    deployTriggered: true,
    environment,
    client: slug,
    message: `Issue #${issueNumber} closed and deployment triggered to ${environment} for client ${slug}`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev issue close_deploy ${issueNumber} --client ${slug} --env ${environment}`,
    },
  };

  return NextResponse.json(response);
}
