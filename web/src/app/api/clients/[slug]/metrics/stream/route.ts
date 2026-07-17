import { NextRequest } from 'next/server';
import { getClientFromPACAPDEV, getDockerMetrics, getDockerStatus } from '@/lib/pacadev-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const client = getClientFromPACAPDEV(slug);

  if (!client) {
    return new Response(JSON.stringify({ error: `Client "${slug}" not found` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = request.nextUrl;
  const interval = Math.max(5, parseInt(searchParams.get('interval') || '10', 10));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      send({ type: 'connected', client: slug, interval, timestamp: new Date().toISOString() });

      const tick = () => {
        const docker = getDockerStatus(slug);
        const metrics = getDockerMetrics(slug);
        send({
          type: 'metrics',
          timestamp: new Date().toISOString(),
          client: slug,
          containerRunning: docker.running,
          containerHealth: docker.health,
          cpu: metrics.cpu,
          memUsed: metrics.memUsed,
          memTotal: metrics.memTotal,
          memPercent: metrics.memPercent,
          available: metrics.available,
        });
      };

      tick();
      const timer = setInterval(tick, interval * 1000);

      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
