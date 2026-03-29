import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import Battle from "@/models/battle";
import BattlePull from "@/models/battle-pull";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  await connectDB();

  const isObjectId = /^[a-f\d]{24}$/i.test(id);
  const battle = await Battle.findOne({
    $or: isObjectId ? [{ _id: id }, { slug: id }] : [{ slug: id }],
  })
    .populate("players.user", "name username image elo")
    .populate("box", "name slug image priceInCoins cardsPerPack")
    .lean();

  if (!battle) {
    return new Response("Battle not found", { status: 404 });
  }

  const battleId = battle._id.toString();
  const channel = `battle:${battleId}`;
  const presenceKey = `battle-presence:${battleId}`;

  const isPlayer = battle.players.some((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = p.user as any;
    const playerUserId =
      user && typeof user === "object" && "_id" in user
        ? String(user._id)
        : String(user);
    return playerUserId === userId;
  });

  const redis = getRedis();

  const encoder = new TextEncoder();
  let subscriberRedis: ReturnType<typeof getRedis> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Track presence
      await redis.sadd(presenceKey, userId);
      await redis.expire(presenceKey, 300);
      const spectatorCount = await redis.scard(presenceKey);

      // Publish updated spectator count
      await redis.publish(
        channel,
        JSON.stringify({ type: "spectator_count", count: spectatorCount })
      );

      // Build initial sync payload
      let myCards = null;
      if (battle.status === "finished" && isPlayer) {
        myCards = await BattlePull.find({
          battle: battle._id,
          distributedTo: userId,
        })
          .populate("card", "name image")
          .lean();
      }

      const syncPayload = JSON.stringify({
        type: "sync",
        battle: {
          _id: battleId,
          slug: battle.slug,
          status: battle.status,
          currentRound: battle.currentRound,
          totalRounds: battle.totalRounds,
          players: battle.players,
          box: battle.box,
          visibility: battle.visibility,
          maxPlayers: battle.maxPlayers,
          completedRounds: battle.rounds,
          spectatorCount,
        },
        isPlayer,
        ...(myCards !== null ? { myCards } : {}),
      });

      controller.enqueue(encoder.encode(`data: ${syncPayload}\n\n`));

      // Subscribe to battle channel
      subscriberRedis = getRedis().duplicate();

      subscriberRedis.on("message", (_ch: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          // Filter distribution events — only forward to the target user
          if (parsed.type === "distribution" && parsed.targetUserId !== userId) {
            return;
          }
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // Stream closed
        }
      });

      await subscriberRedis.subscribe(channel);

      // Keepalive every 30s — also refreshes presence TTL
      const keepalive = setInterval(() => {
        void (async () => {
          try {
            await redis.expire(presenceKey, 300);
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            clearInterval(keepalive);
          }
        })();
      }, 30000);

      _req.signal.addEventListener("abort", async () => {
        clearInterval(keepalive);
        if (subscriberRedis) {
          subscriberRedis.unsubscribe(channel).catch(() => {});
          subscriberRedis.disconnect();
        }
        // Remove presence and publish updated count
        try {
          await redis.srem(presenceKey, userId);
          const updatedCount = await redis.scard(presenceKey);
          await redis.publish(
            channel,
            JSON.stringify({ type: "spectator_count", count: updatedCount })
          );
        } catch {
          // Redis may be unavailable
        }
        try {
          controller.close();
        } catch {
          // already closed
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
