import { eventBus } from '@/server/lib/eventBus';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(event: string, data: unknown) {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      }

      // Send initial heartbeat
      sendEvent('connected', { ts: new Date().toISOString() });

      const unsubDonation = eventBus.subscribe(
        'donation.matched',
        (payload) => {
          sendEvent('donation.matched', payload);
        },
      );

      const unsubPool = eventBus.subscribe(
        'pool.updated',
        (payload) => {
          sendEvent('pool.updated', payload);
        },
      );

      // Heartbeat every 20s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20_000);

      req.signal.addEventListener('abort', () => {
        unsubDonation();
        unsubPool();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      // cleanup handled by abort signal
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
