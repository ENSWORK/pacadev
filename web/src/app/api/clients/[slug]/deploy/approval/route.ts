import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, deployApprove, getApprovals } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const approvals = getApprovals(slug);
  const response: APIResponse<typeof approvals> = {
    success: true,
    data: approvals,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      total: approvals.length,
      cli_equivalent: `cat ~/.pacadev/approvals.jsonl | jq 'select(.client=="${slug}")'`,
    },
  };
  return NextResponse.json(response);
}

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
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev deploy approve --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { env = 'staging', reason, module, approveToken, dryRun = true } = body as {
    env?: 'staging' | 'prod';
    reason?: string;
    module?: string;
    approveToken?: string;
    dryRun?: boolean;
  };

  if (!reason) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Champ requis manquant: reason'],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev deploy approve --client ${slug} --env ${env} --reason "..."` },
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (env === 'prod' && !approveToken) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: ['Token d\'approbation requis pour déploiement prod (approveToken)'],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', client: slug, cli_equivalent: `pacadev deploy approve --client ${slug} --env prod --approve-token <TOKEN>` },
    };
    return NextResponse.json(response, { status: 400 });
  }

  const data = deployApprove(slug, env, reason, module, approveToken, dryRun);

  const response: APIResponse<typeof data> = {
    success: data.success,
    data,
    errors: data.success ? [] : [data.message],
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `pacadev deploy approve --client ${slug} --env ${env} --reason "${reason}"${dryRun ? ' --dry-run' : ''}`,
    },
  };

  return NextResponse.json(response);
}
