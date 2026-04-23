import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import {
  appendChatArchiveEvent,
  ensureGlobalChatRoom,
  publishRoomEvent,
  serializeChatMessageWithCurrentRelations,
} from "@/lib/chat";
import { getChatRoleBadgeLabel } from "@/lib/chat-constants";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import Box from "@/models/box";
import User from "@/models/user";
import CoinTransaction from "@/models/coin-transaction";
import ChatMessage from "@/models/chat-message";
import ChatRoom from "@/models/chat-room";
import Card from "@/models/card";
import Season from "@/models/season";
import { scheduleBattleJob } from "@/lib/battle-jobs";


const VALID_PLAYER_COUNTS = [2, 3, 4] as const;
const VALID_ROUNDS = [3, 5, 7] as const;
const VALID_MODES = ["lowest_card", "highest_card"] as const;
const LOBBY_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ---------- Announce battle in global chat ----------

async function publishBattleCreatedChatMessage(input: {
  userId: string;
  battleId: string;
  battleSlug: string;
  boxName: string;
  boxImage: string | null;
  boxGame: string;
  entryFee: number;
  rounds: number;
  playerCount: number;
  mode: string;
  previewCards: string[];
}) {
  try {
    if (!Types.ObjectId.isValid(input.userId)) return;

    const [room, userDoc] = await Promise.all([
      ensureGlobalChatRoom(),
      User.findById(input.userId).select("username role image identityVerified").lean(),
    ]);

    if (!userDoc) return;

    const displayName = userDoc.username?.trim() || "Ein Spieler";
    const authorSnapshot = {
      name: userDoc.username?.trim() || "Nutzer",
      username: userDoc.username ?? null,
      role: userDoc.role ?? "user",
      roleBadge: getChatRoleBadgeLabel(userDoc.role ?? "user"),
      profileBadges: [],
      avatarUrl: userDoc.image ?? null,
      identityVerified: Boolean(userDoc.identityVerified),
    };

    const authorUserId = new Types.ObjectId(input.userId);

    const bodyOriginal = `${displayName} hat ein Battle erstellt! ⚔️`;

    const updatedRoom = await ChatRoom.findOneAndUpdate(
      { _id: room._id },
      {
        $inc: { submissionSeq: 1, visibleSeq: 1 },
        $set: { lastVisibleMessageAt: new Date() },
      },
      { returnDocument: "after" }
    );

    if (!updatedRoom) return;

    const message = await ChatMessage.create({
      roomId: room._id,
      roomSlug: room.slug,
      submissionSeq: updatedRoom.submissionSeq,
      visibleSeq: updatedRoom.visibleSeq,
      authorUserId,
      source: "system",
      authorSnapshot,
      bodyOriginal,
      bodyNormalized: bodyOriginal.toLowerCase(),
      bodyDisplay: bodyOriginal,
      status: "visible",
      clientNonce: randomUUID(),
      mentionTargets: [],
      hasMention: false,
      hasLink: false,
      hasPII: false,
      battleInvite: {
        battleId: input.battleId,
        battleSlug: input.battleSlug,
        boxName: input.boxName,
        boxImage: input.boxImage,
        boxGame: input.boxGame,
        entryFee: input.entryFee,
        rounds: input.rounds,
        playerCount: input.playerCount,
        mode: input.mode,
        previewCards: input.previewCards,
      },
      moderation: {
        provider: "local",
        action: "allow",
        reasonCodes: [],
      },
    });

    await appendChatArchiveEvent({
      roomId: room._id,
      roomSlug: room.slug,
      eventType: "message_visible",
      messageId: message._id,
      submissionSeq: message.submissionSeq,
      actorUserId: authorUserId,
      payload: {
        visibleSeq: message.visibleSeq,
        battleInvite: message.battleInvite,
        source: "battle_created",
      },
    });

    const serializedMessage = await serializeChatMessageWithCurrentRelations(message);
    await publishRoomEvent(room.slug, {
      type: "message_created",
      payload: { message: serializedMessage },
    });
  } catch (err) {
    console.error("[battles] chat announcement error:", err);
  }
}

// ---------- GET: List battles (lobby) ----------

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "waiting";

    const query: Record<string, unknown> = {};

    if (status === "mine") {
      // User's active battles
      query["players.user"] = session.user.id;
      query.status = { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] };
    } else {
      // Open battles in lobby
      query.status = status;
      query["settings.isPrivate"] = false;
      query.lobbyExpiresAt = { $gt: new Date() };
    }

    const battles = await Battle.find(query)
      .populate("box", "name slug game image priceInCoins")
      .populate("creator", "username")
      .populate("players.user", "username")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ battles });
  } catch (err) {
    console.error("[battles] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ---------- POST: Create battle ----------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const body = await req.json();
    const { boxId, playerCount, rounds, mode, isPrivate } = body;

    // Validate inputs
    if (!boxId) {
      return NextResponse.json({ error: "box_required" }, { status: 400 });
    }
    if (!VALID_PLAYER_COUNTS.includes(playerCount)) {
      return NextResponse.json({ error: "invalid_player_count" }, { status: 400 });
    }
    if (!VALID_ROUNDS.includes(rounds)) {
      return NextResponse.json({ error: "invalid_rounds" }, { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
    }

    // Check box exists and is published
    void Card; // ensure Card model is registered for populate
    const box = await Box.findById(boxId)
      .populate("cards.card", "image internalPrice marketPrice variants")
      .lean();
    if (!box || box.status !== "published") {
      return NextResponse.json({ error: "box_not_available" }, { status: 400 });
    }
    // Tutorial boxes are tour-only — never usable in battles.
    if ((box as { isTutorial?: boolean }).isTutorial) {
      return NextResponse.json(
        { error: "tutorial_box_not_battle_eligible" },
        { status: 400 },
      );
    }

    if (!box.priceInCoins || box.priceInCoins <= 0) {
      return NextResponse.json({ error: "box_not_battle_enabled" }, { status: 400 });
    }

    // Check user is not in an active battle (ignore expired lobbies)
    const now = new Date();
    const activeBattle = await Battle.findOne({
      "players.user": session.user.id,
      status: { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] },
      $or: [
        { status: { $ne: "waiting" } },
        { lobbyExpiresAt: { $gt: now } },
      ],
    }).lean();

    if (activeBattle) {
      return NextResponse.json({ error: "already_in_battle" }, { status: 409 });
    }

    // Calculate entry fee: 5 cards per round × rounds × pack price
    const CARDS_PER_HAND = 5;
    const entryFee = rounds * CARDS_PER_HAND * box.priceInCoins;

    // Reserve coins atomically
    const user = await User.findOneAndUpdate(
      { _id: session.user.id, coins: { $gte: entryFee } },
      { $inc: { coins: -entryFee, "battleStats.battlesCreated": 1 } },
      { new: true },
    );

    if (!user) {
      return NextResponse.json({ error: "insufficient_coins" }, { status: 400 });
    }

    // Record coin transaction
    await CoinTransaction.create({
      userId: session.user.id,
      amount: -entryFee,
      type: "battle_entry",
      reason: `Battle entry fee (${rounds} rounds × ${CARDS_PER_HAND} cards × ${box.priceInCoins} coins)`,
      relatedBattleId: null, // Will be updated after battle creation
    });

    // Generate invite code for private battles
    const inviteCode = isPrivate
      ? Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")
      : null;

    // Find active season
    const activeSeason = await Season.findOne({ status: "active" }).lean();

    // Create battle
    const battle = await Battle.create({
      creator: session.user.id,
      box: boxId,
      players: [
        {
          user: session.user.id,
          joinedAt: new Date(),
          isReady: false,
          readyAt: null,
          roundsWon: 0,
        },
      ],
      settings: {
        playerCount,
        rounds,
        mode,
        isPrivate: !!isPrivate,
        inviteCode,
      },
      entryFee,
      status: "waiting",
      currentRound: 0,
      lobbyExpiresAt: new Date(Date.now() + LOBBY_DURATION_MS),
      seasonId: activeSeason?._id ?? null,
    });

    // Update coin transaction with battle ID
    await CoinTransaction.updateOne(
      { userId: session.user.id, type: "battle_entry", relatedBattleId: null },
      { $set: { relatedBattleId: battle._id } },
    );

    // Schedule auto-cancel when lobby expires
    await scheduleBattleJob("auto-cancel", { battleId: battle._id.toString() }, LOBBY_DURATION_MS + 5000);

    // Announce public battles in global chat (fire-and-forget)
    if (!isPrivate) {
      // Extract top 3 card images for the preview fan from already-populated box
      const cardEntries = (box.cards ?? []) as Array<{
        card?: { image?: string; internalPrice?: number; marketPrice?: number; variants?: Array<{ price: number }> } | Types.ObjectId;
      }>;
      const validCards = cardEntries
        .map((c) => c.card)
        .filter((c): c is { image: string; internalPrice?: number; marketPrice?: number; variants?: Array<{ price: number }> } =>
          !!c && typeof c === "object" && "image" in c && !!c.image
        );
      validCards.sort((a, b) => {
        const priceA = a.internalPrice ?? a.marketPrice ?? Math.max(0, ...(a.variants?.map((v) => v.price) || [0]));
        const priceB = b.internalPrice ?? b.marketPrice ?? Math.max(0, ...(b.variants?.map((v) => v.price) || [0]));
        return priceB - priceA;
      });
      const previewCards = validCards.slice(0, 3).map((c) => c.image);

      publishBattleCreatedChatMessage({
        userId: session.user.id!,
        battleId: battle._id.toString(),
        battleSlug: battle.slug,
        boxName: box.name?.de || box.name?.en || "Box",
        boxImage: box.image ?? null,
        boxGame: box.game ?? "",
        entryFee,
        rounds,
        playerCount,
        mode,
        previewCards,
      }).catch((err) => console.error("[battles] chat announcement error:", err));
    }

    return NextResponse.json({
      battle: {
        _id: battle._id,
        slug: battle.slug,
        entryFee,
        inviteCode,
        newBalance: user.coins,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[battles] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
