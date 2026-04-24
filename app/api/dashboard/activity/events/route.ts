import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/redis";
import { activityChannel } from "@/lib/dashboard/activity";

// Side-effect import: registers Mongoose post-save hooks once per process.
import "@/lib/dashboard/activity-publisher";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const channel = activityChannel(userId);
  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      try {
        subscriberRedis = getRedis().duplicate();
      } catch (err) {
        console.error("[activity SSE] failed to duplicate redis:", (err as Error)?.message);
        controller.error(err);
        return;
      }

      subscriberRedis.on("message", (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          /* stream closed */
        }
      });

      try {
        await subscriberRedis.subscribe(channel);
      } catch (err) {
        console.warn("[activity SSE] subscribe failed:", (err as Error)?.message);
      }

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe(channel).catch(() => {});
          subscriberRedis.disconnect();
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
