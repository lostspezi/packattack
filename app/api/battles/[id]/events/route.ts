import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import {
  subscribeToBattle,
  replayBattleEventsAfter,
  type BattleEvent,
} from "@/lib/battle-events";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
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
  const lastEventId = req.headers.get("last-event-id");

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sentStreamIds = new Set<string>();
      let replayDone = false;
      const liveBuffer: Array<{ streamId: string | null; payload: string }> = [];

      function enqueue(streamId: string | null, payload: string) {
        if (streamId) {
          if (sentStreamIds.has(streamId)) return;
          sentStreamIds.add(streamId);
        }
        try {
          const idLine = streamId ? `id: ${streamId}\n` : "";
          controller.enqueue(encoder.encode(`${idLine}data: ${payload}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // Returns the serialized payload for a BattleEvent, filtering the
      // per-player round_start hand so each SSE client only sees its own.
      function serializeForUser(event: BattleEvent): string | null {
        if (event.type === "round_start") {
          const eventPlayerId = event.data.playerId as string | undefined;
          if (eventPlayerId && eventPlayerId !== userId) {
            return JSON.stringify({
              type: event.type,
              data: {
                roundNumber: event.data.roundNumber,
                selectDeadline: event.data.selectDeadline,
                // hand omitted — this event is for another player
              },
              timestamp: event.timestamp,
              streamId: event.streamId,
            });
          }
        }
        return JSON.stringify(event);
      }

      // Initial connection marker — no stream ID so it doesn't overwrite the
      // browser's lastEventId.
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", battleId })}\n\n`),
        );
      } catch {
        // already closed
      }

      // Subscribe first so events that fire during replay are buffered, not lost.
      const { unsubscribe } = subscribeToBattle(battleId, (event: BattleEvent) => {
        const payload = serializeForUser(event);
        if (!payload) return;
        const streamId = event.streamId ?? null;
        if (!replayDone) {
          liveBuffer.push({ streamId, payload });
        } else {
          enqueue(streamId, payload);
        }
      });

      // Replay events the client missed during disconnect. Redis Stream entries
      // are in chronological order, so we can forward them one by one.
      if (lastEventId) {
        const missed = await replayBattleEventsAfter(battleId, lastEventId);
        for (const entry of missed) {
          try {
            const event = JSON.parse(entry.rawData) as BattleEvent;
            event.streamId = entry.streamId;
            const payload = serializeForUser(event);
            if (payload) enqueue(entry.streamId, payload);
          } catch {
            // skip malformed entry
          }
        }
      }

      replayDone = true;

      // Flush anything that arrived via pub/sub while we were replaying.
      // sentStreamIds dedups overlaps between replay and live.
      for (const buffered of liveBuffer) {
        enqueue(buffered.streamId, buffered.payload);
      }
      liveBuffer.length = 0;

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.signal.addEventListener("abort", () => {
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
