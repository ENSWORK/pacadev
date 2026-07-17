import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, retriggerPipeline } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `gh workflow run pipeline.yml --repo ENSWORK/pacadev` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { workflow = 'pipeline.yml' } = body as { workflow?: string };

  const data = retriggerPipeline(slug, workflow);

  const response: APIResponse<typeof data> = {
    success: data.success,
    data,
    errors: data.success ? [] : [data.message],
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `gh workflow run ${workflow} --repo ENSWORK/pacadev --ref ${data.branch}`,
    },
  };

  return NextResponse.json(response);
}
