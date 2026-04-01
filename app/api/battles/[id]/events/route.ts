import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import { subscribeToBattle, type BattleEvent } from "@/lib/battle-events";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const isObjectId = /^[a-f\d]{24}$/i.test(id);
  const query = isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };
  const battle = await Battle.findOne(query).select("_id players").lean();
  if (!battle) {
    return new Response("Battle not found", { status: 404 });
  }

  const userId = session.user.id;
  const battleId = battle._id.toString();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // Send initial connection event
      send(JSON.stringify({ type: "connected", battleId }));

      // Subscribe to battle events
      const { unsubscribe } = subscribeToBattle(battleId, (event: BattleEvent) => {
        // Filter round_start events — only send the player's own hand
        if (event.type === "round_start") {
          const eventPlayerId = event.data.playerId as string;
          if (eventPlayerId !== userId) {
            // Send a stripped version (just notification that round started)
            send(JSON.stringify({
              type: "round_start",
              data: {
                roundNumber: event.data.roundNumber,
                selectDeadline: event.data.selectDeadline,
                // Other players don't see the hand
              },
              timestamp: event.timestamp,
            }));
            return;
          }
        }
        send(JSON.stringify(event));
      });

      // Heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      // Store cleanup so cancel() can also call it
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      // Cleanup on close
      _req.signal.addEventListener("abort", () => {
        cleanup?.();
        cleanup = null;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      cleanup?.();
      cleanup = null;
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
