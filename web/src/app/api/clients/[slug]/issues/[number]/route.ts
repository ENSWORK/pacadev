import { NextResponse } from 'next/server';
import { mockClients, mockTickets } from '@/lib/mock-data';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
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
        cli_equivalent: `pacadev issue view ${issueNumber} --repo ${slug}`,
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
        cli_equivalent: `pacadev issue view ${issueNumber} --repo ${slug}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const response: APIResponse<typeof issue> = {
    success: true,
    data: issue,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev issue view ${issueNumber} --repo ${slug}`,
    },
  };

  return NextResponse.json(response);
}

export async function PATCH(
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
        cli_equivalent: `pacadev issue update ${issueNumber}`,
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
        cli_equivalent: `pacadev issue update ${issueNumber}`,
      },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { comment, close, label } = body as { comment?: string; close?: boolean; label?: string };

  const updates: string[] = [];
  if (comment) updates.push(`Comment added: "${comment}"`);
  if (close) updates.push('Issue closed');
  if (label) updates.push(`Label added: "${label}"`);

  if (updates.length === 0) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['No update specified. Provide at least one of: comment, close, label'],
      meta: {
        timestamp: new Date().toISOString(),
        user: 'admin@enswork.com',
        client: slug,
        cli_equivalent: `pacadev issue update ${issueNumber}`,
      },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const cliParts = [`pacadev issue update ${issueNumber}`];
  if (comment) cliParts.push(`--comment "${comment}"`);
  if (close) cliParts.push('--close');
  if (label) cliParts.push(`--label "${label}"`);

  const data = {
    id: issue.id,
    title: issue.title,
    status: close ? 'closed' : issue.status,
    labels: label ? [...issue.labels, label] : issue.labels,
    updates,
    updatedAt: new Date().toISOString(),
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: cliParts.join(' '),
    },
  };

  return NextResponse.json(response);
}
