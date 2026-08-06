import { NextResponse } from 'next/server';
import { getClientFromPACAPDEV, getDockerMetrics, getDockerStatus } from '@/lib/pacadev-service';
import type { APIResponse } from '@/lib/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    const response: APIResponse<null> = {
      success: false,
      data: null,
      errors: [`Client "${slug}" not found`],
      meta: { timestamp: new Date().toISOString(), user: 'admin@enswork.com', cli_equivalent: `pacadev metrics --client ${slug}` },
    };
    return NextResponse.json(response, { status: 404 });
  }

  const dockerMetrics = getDockerMetrics(slug);
  const dockerStatus = getDockerStatus(slug);

  const data = {
    clientId: client.id,
    period: 'live',
    containerRunning: dockerStatus.running,
    containerHealth: dockerStatus.health,
    metrics: {
      cpu: { value: dockerMetrics.cpu, unit: '%', trend: 'live', threshold: 80, available: dockerMetrics.available },
      memory: { value: dockerMetrics.memPercent, unit: '%', used: dockerMetrics.memUsed, total: dockerMetrics.memTotal, trend: 'live', threshold: 90, available: dockerMetrics.available },
      disk: { value: null, unit: '%', trend: 'n/a', threshold: 85, available: false },
      dbConnections: { value: null, unit: 'connections', trend: 'n/a', max: 100, available: false },
    },
    source: dockerMetrics.available ? 'docker stats' : 'container offline',
    cli_source: `docker stats --no-stream ${slug}_odoo`,
  };

  const response: APIResponse<typeof data> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      user: 'admin@enswork.com',
      client: slug,
      cli_equivalent: `docker stats --no-stream ${slug}_odoo`,
    },
  };

  return NextResponse.json(response);
}
