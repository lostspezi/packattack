import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import User from "@/models/user";
import { getRedis } from "@/lib/redis";
import { battleChatSchema } from "@/lib/validations/battle";
import { PRESET_CHAT_MESSAGES, PRESET_CHAT_COOLDOWN_MS } from "@/lib/battle-constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: battleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = battleChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messageKey } = parsed.data;

  const message = PRESET_CHAT_MESSAGES.find((m) => m.key === messageKey);
  if (!message) {
    return NextResponse.json({ error: "Unknown message key" }, { status: 400 });
  }

  try {
    await connectDB();

    // Rate limit: one message per PRESET_CHAT_COOLDOWN_MS per user per battle
    const redis = getRedis();
    const rateLimitKey = `battle-chat:${battleId}:${userId}`;
    const rateLimitResult = await redis.set(rateLimitKey, "1", "PX", PRESET_CHAT_COOLDOWN_MS, "NX");
    if (!rateLimitResult) {
      return NextResponse.json({ error: "rate_limited", message: "Please wait before sending another message." }, { status: 429 });
    }

    // Load battle
    const isObjectId = /^[a-f\d]{24}$/i.test(battleId);
    const battle = await Battle.findOne(
      isObjectId ? { $or: [{ _id: battleId }, { slug: battleId }] } : { slug: battleId }
    ).lean();

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    if (battle.status === "cancelled") {
      return NextResponse.json({ error: "Battle is cancelled" }, { status: 409 });
    }

    // Determine if user is a player or spectator
    const isPlayer = battle.players.some((p) => p.user.toString() === userId);
    const isSpectator = !isPlayer;

    // Enforce spectator-only rule
    if (message.spectatorOnly && !isSpectator) {
      return NextResponse.json({ error: "This message can only be sent by spectators." }, { status: 403 });
    }
    if (!message.spectatorOnly && isSpectator) {
      return NextResponse.json({ error: "This message can only be sent by players." }, { status: 403 });
    }

    // Get user info for the published event
    const userDoc = await User.findById(userId).select("name username image").lean();
    const userName = userDoc?.name ?? userDoc?.username ?? "User";
    const userImage = userDoc?.image ?? null;

    // Publish chat message to Redis channel
    await redis.publish(
      `battle:${battleId}`,
      JSON.stringify({
        type: "chat_message",
        userId,
        userName,
        userImage,
        messageKey: message.key,
        de: message.de,
        en: message.en,
        category: message.category,
        isSpectator,
        timestamp: Date.now(),
      })
    );

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[battles/[id]/chat POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
