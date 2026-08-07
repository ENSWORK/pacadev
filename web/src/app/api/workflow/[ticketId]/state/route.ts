import { NextResponse } from 'next/server';
import { getWorkflowState } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client') || undefined;

  const ticketNum = parseInt(ticketId, 10);
  if (isNaN(ticketNum)) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['ticketId must be a number'],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev workflow state --ticket ${ticketId}` },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const state = getWorkflowState(ticketNum, slug);

  const response: APIResponse<typeof state> = {
    success: true,
    data: state,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      source: state ? 'github' : 'unavailable',
      cli_equivalent: `pacadev workflow state --ticket ${ticketId}`,
    },
  };

  return NextResponse.json(response);
}
