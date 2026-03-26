import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: boxId } = await params;
  const channel = `box-events:${boxId}`;

  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Create a dedicated Redis connection for subscribing
      subscriberRedis = getRedis().duplicate();

      subscriberRedis.on("message", (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Stream closed
        }
      });

      await subscriberRedis.subscribe(channel);

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Cleanup on abort
      _req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe(channel).catch(() => {});
          subscriberRedis.disconnect();
        }
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      if (subscriberRedis) {
        subscriberRedis.unsubscribe(channel).catch(() => {});
        subscriberRedis.disconnect();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
