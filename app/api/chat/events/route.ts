import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import {
  addChatPresence,
  createChatConnectionId,
  ensureGlobalChatRoom,
  getChatRoomRedisChannel,
  getChatUserRedisChannel,
  publishRoomState,
  removeChatPresence,
  touchChatPresence,
} from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectDB();
  const room = await ensureGlobalChatRoom();
  const connectionId = createChatConnectionId();

  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;
  let lastPresenceCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Shared teardown. Safe to call from any failure path — idempotent
      // via `teardownStarted` so abort + keepalive-fail + cancel don't
      // race into double-disconnect.
      let teardownStarted = false;
      let keepalive: ReturnType<typeof setInterval> | null = null;
      const teardown = async (reason: "abort" | "cancel" | "keepalive_failed") => {
        if (teardownStarted) return;
        teardownStarted = true;
        if (keepalive) clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe().catch(() => {});
          subscriberRedis.disconnect();
          subscriberRedis = null;
        }
        try {
          lastPresenceCount = await removeChatPresence(room.slug, connectionId);
          await publishRoomState(room);
        } catch {
          // presence cleanup best-effort
        }
        if (reason !== "cancel") {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      controller.enqueue(encoder.encode(": connected\n\n"));

      lastPresenceCount = await addChatPresence(room.slug, session.user.id, connectionId);
      await publishRoomState(room);

      subscriberRedis = getRedis().duplicate();
      subscriberRedis.on("message", (_channel: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          void teardown("keepalive_failed");
        }
      });

      await subscriberRedis.subscribe(
        getChatRoomRedisChannel(room.slug),
        getChatUserRedisChannel(session.user.id)
      );

      keepalive = setInterval(() => {
        void (async () => {
          try {
            const nextPresenceCount = await touchChatPresence(
              room.slug,
              session.user.id,
              connectionId
            );
            if (nextPresenceCount !== lastPresenceCount) {
              lastPresenceCount = nextPresenceCount;
              await publishRoomState(room);
            }
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            // enqueue throws once the stream is closed — that's our cue
            // that the abort listener never fired (proxy timeout, dropped
            // TCP, etc.) and we need to tear down actively.
            void teardown("keepalive_failed");
          }
        })();
      }, 30000);

      _req.signal.addEventListener("abort", () => {
        void teardown("abort");
      });
    },
    cancel() {
      if (subscriberRedis) {
        subscriberRedis.unsubscribe().catch(() => {});
        subscriberRedis.disconnect();
        subscriberRedis = null;
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
