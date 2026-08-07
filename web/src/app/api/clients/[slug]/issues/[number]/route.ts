import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, updateClientIssue } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; number: string }> }
) {
  const { slug, number } = await params;
  const issueNumber = Number(number);

  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev issue update ${issueNumber} --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const result = updateClientIssue(slug, issueNumber, body);

  if (!result.success) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [result.message],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev issue update ${issueNumber} --client ${slug}` },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const response: APIResponse<null> = {
    success: true,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev issue update ${issueNumber} --client ${slug}`,
      message: result.message,
    },
  };

  return NextResponse.json(response);
}
