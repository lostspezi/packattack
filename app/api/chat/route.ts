import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  appendChatArchiveEvent,
  buildChatOverviewForUser,
  buildChatPermissions,
  ensureChatReadState,
  ensureChatUserState,
  ensureGlobalChatPolicy,
  ensureGlobalChatRoom,
  fetchVisibleMessages,
  publishRoomEvent,
  serializeChatMessage,
  serializeChatMessagesWithCurrentBadgeDefinitions,
  serializeChatReadState,
  serializeChatRoom,
} from "@/lib/chat";
import {
  canPostChatLinks,
  CHAT_HISTORY_PAGE_SIZE,
  CHAT_ROOM_SLUG,
  isChatStaff,
} from "@/lib/chat-constants";
import { escapeMentionRegex, extractMentionUsernames } from "@/lib/chat-mentions";
import { containsChatLink, normalizeChatBody } from "@/lib/chat-links";
import { getLegacyBadgeSummaries, getUserBadgeSummariesForUsers } from "@/lib/badges";
import { sanitizeIncomingChatGif } from "@/lib/giphy";
import { moderateChatMessage } from "@/lib/chat-moderation";
import { assertChatSubmissionAllowed } from "@/lib/chat-rate-limit";
import connectDB from "@/lib/db";
import { createChatMessageSchema } from "@/lib/validations";
import ChatMessage from "@/models/chat-message";
import ChatRoom from "@/models/chat-room";
import User from "@/models/user";

export const dynamic = "force-dynamic";

function parseNumber(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getErrorStatus(code: string): number {
  switch (code) {
    case "links_not_allowed":
    case "message_blocked":
    case "read_only":
    case "announcement_only":
    case "not_verified":
    case "timeout_active":
    case "banned":
      return 400;
    case "rate_limited":
    case "slow_mode_active":
      return 429;
    case "moderation_unavailable":
    case "gifs_unavailable":
      return 503;
    default:
      return 400;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const beforeVisibleSeq = parseNumber(url.searchParams.get("beforeVisibleSeq"), 0) || undefined;
    const limit = Math.min(
      100,
      Math.max(1, parseNumber(url.searchParams.get("limit"), CHAT_HISTORY_PAGE_SIZE))
    );

    const overview = await buildChatOverviewForUser(user as never);
    if (!beforeVisibleSeq && limit === CHAT_HISTORY_PAGE_SIZE) {
      return NextResponse.json(overview);
    }

    const room = await ensureGlobalChatRoom();
    const readState = await ensureChatReadState(room._id, userId);
    const messages = await fetchVisibleMessages(room._id, beforeVisibleSeq, limit, {
      includeRemoved: false,
    });
    const serializedMessages = await serializeChatMessagesWithCurrentBadgeDefinitions(
      messages as never
    );

    return NextResponse.json({
      ...overview,
      messages: serializedMessages,
      readState: serializeChatReadState(readState),
      room: serializeChatRoom(room, overview.room.onlineCount),
    });
  } catch (error) {
    console.error("[chat GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const room = await ensureGlobalChatRoom();
    const policy = await ensureGlobalChatPolicy();
    const userState = await ensureChatUserState(user as never);
    const readState = await ensureChatReadState(room._id, userId);
    const permissions = buildChatPermissions({
      user: user as never,
      room,
      userState,
      moderationReady: policy.provider !== "none",
    });

    if (room.requireEmailVerifiedToPost && !user.emailVerified && !isChatStaff(user.role)) {
      return NextResponse.json({ error: "not_verified" }, { status: 400 });
    }
    if (permissions.chatStatus === "banned") {
      return NextResponse.json({ error: "banned" }, { status: 400 });
    }
    if (permissions.chatStatus === "timed_out") {
      return NextResponse.json(
        { error: "timeout_active", timeoutUntil: permissions.timeoutUntil },
        { status: 400 }
      );
    }
    if (!permissions.moderationReady && !isChatStaff(user.role)) {
      return NextResponse.json({ error: "moderation_unavailable" }, { status: 503 });
    }
    if (parsed.data.gif && !permissions.canUseGifs) {
      return NextResponse.json({ error: "gifs_unavailable" }, { status: 503 });
    }
    if (room.mode === "read_only") {
      return NextResponse.json({ error: "read_only" }, { status: 400 });
    }
    if (room.mode === "announcement_only" && !isChatStaff(user.role)) {
      return NextResponse.json({ error: "announcement_only" }, { status: 400 });
    }

    const normalizedBody = normalizeChatBody(parsed.data.body);
    const gif = sanitizeIncomingChatGif(parsed.data.gif);
    if (parsed.data.gif && !gif) {
      return NextResponse.json({ error: "invalid_gif" }, { status: 400 });
    }
    const hasLink = containsChatLink(normalizedBody);
    if (hasLink && !canPostChatLinks(user.role)) {
      return NextResponse.json({ error: "links_not_allowed" }, { status: 400 });
    }

    const rateLimit = await assertChatSubmissionAllowed({
      userId,
      normalizedBody: JSON.stringify({
        body: normalizedBody,
        gifId: gif?.id ?? null,
      }),
      trustTier: permissions.trustTier,
      slowModeSeconds: room.mode === "slow_mode" ? room.slowModeSeconds : 0,
      lastSubmittedAt: userState.lastSubmittedAt,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: rateLimit.error ?? "rate_limited",
          retryAfterSeconds: rateLimit.retryAfterSeconds ?? null,
        },
        { status: getErrorStatus(rateLimit.error ?? "rate_limited") }
      );
    }

    const moderation =
      normalizedBody.length > 0
        ? await moderateChatMessage({
            body: normalizedBody,
            lang: user.preferences?.language ?? "de",
            isAdminLinkMessage: hasLink && canPostChatLinks(user.role),
            trustTier: permissions.trustTier,
          })
        : {
            provider: "local" as const,
            action: "allow" as const,
            reasonCodes: [],
            bodyDisplay: "",
            hasPII: false,
          };

    const shadowMuted = userState.chatStatus === "shadow_muted";
    const shouldBeVisible =
      !shadowMuted && (moderation.action === "allow" || moderation.action === "mask");
    const status = shadowMuted
      ? "shadow_hidden"
      : shouldBeVisible
        ? "visible"
        : moderation.action === "hold"
          ? "held"
          : moderation.action === "shadow_hide"
            ? "shadow_hidden"
            : "blocked";

    const updatedRoom = await ChatRoom.findOneAndUpdate(
      { slug: CHAT_ROOM_SLUG },
      shouldBeVisible
        ? {
            $inc: { submissionSeq: 1, visibleSeq: 1 },
            $set: { lastVisibleMessageAt: new Date() },
          }
        : {
            $inc: { submissionSeq: 1 },
          },
      { returnDocument: "after" }
    );

    if (!updatedRoom) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const mentionUsernames = normalizedBody
      ? extractMentionUsernames(normalizedBody).slice(0, 8)
      : [];
    const mentionUsers =
      mentionUsernames.length > 0
        ? await User.find(
            {
              $or: mentionUsernames.map((username) => ({
                username: new RegExp(`^${escapeMentionRegex(username)}$`, "i"),
              })),
            },
            "name username"
          ).lean()
        : [];
    const mentionTargets = mentionUsers
      .filter((target): target is typeof target & { username: string } => Boolean(target.username))
      .map((target) => ({
        userId: target._id,
        username: target.username,
        name: target.name?.trim() || target.username,
      }));
    const hasMention = mentionTargets.length > 0;
    const badgeMap = await getUserBadgeSummariesForUsers([user._id]);
    const profileBadges =
      badgeMap.get(user._id.toString()) ?? getLegacyBadgeSummaries(user as never);
    const message = await ChatMessage.create({
      roomId: room._id,
      roomSlug: room.slug,
      submissionSeq: updatedRoom.submissionSeq,
      visibleSeq: shouldBeVisible ? updatedRoom.visibleSeq : null,
      authorUserId: user._id,
      source:
        user.role === "admin" || user.role === "super_admin"
          ? "admin"
          : user.role === "moderator"
            ? "moderator"
            : "user",
      authorSnapshot: {
        name: user.name,
        username: user.username ?? null,
        role: user.role,
        roleBadge:
          user.role === "admin" || user.role === "super_admin"
            ? "ADMIN"
            : user.role === "moderator"
              ? "MOD"
              : user.role === "shop"
                ? "SHOP"
                : null,
        profileBadges: profileBadges.map((badge) => ({
          key: badge.key,
          slug: badge.slug,
          label: badge.label,
          iconUrl: badge.iconUrl,
          description: badge.description,
          tone: badge.tone,
          awardedAt: badge.awardedAt ? new Date(badge.awardedAt) : null,
          awardReason: badge.awardReason,
          category: badge.category,
        })),
        avatarUrl: user.image ?? null,
        identityVerified: Boolean(user.identityVerified),
      },
      bodyOriginal: normalizedBody,
      bodyNormalized: normalizedBody.toLowerCase(),
      bodyDisplay: moderation.bodyDisplay,
      gif,
      status,
      clientNonce: randomUUID(),
      mentionTargets,
      hasMention,
      hasLink,
      hasPII: moderation.hasPII,
      moderation: {
        provider: moderation.provider,
        action: moderation.action,
        reasonCodes: moderation.reasonCodes,
      },
    });

    await appendChatArchiveEvent({
      roomId: room._id,
      eventType: "message_submitted",
      messageId: message._id,
      submissionSeq: message.submissionSeq,
      actorUserId: userId,
      payload: {
        bodyOriginal: normalizedBody,
        gif,
        status: message.status,
        moderation: message.moderation,
        authorSnapshot: message.authorSnapshot,
        mentionTargets: message.mentionTargets,
      },
    });

    await userState.updateOne({
      $set: {
        lastSubmittedAt: new Date(),
      },
      ...(shouldBeVisible ? { $inc: { successfulMessageCount: 1 } } : {}),
    });

    if (shouldBeVisible && message.visibleSeq) {
      await readState.updateOne({
        $set: {
          lastReadVisibleSeq: message.visibleSeq,
          lastSeenVisibleSeq: message.visibleSeq,
        },
      });

      await appendChatArchiveEvent({
        roomId: room._id,
        eventType: "message_visible",
        messageId: message._id,
        submissionSeq: message.submissionSeq,
        actorUserId: userId,
        payload: {
          visibleSeq: message.visibleSeq,
          gif,
        },
      });

      await publishRoomEvent(room.slug, {
        type: "message_created",
        payload: {
          message: serializeChatMessage(message),
        },
      });
    } else if (message.status === "held") {
      await appendChatArchiveEvent({
        roomId: room._id,
        eventType: "message_held",
        messageId: message._id,
        submissionSeq: message.submissionSeq,
        actorUserId: userId,
        payload: {
          reasonCodes: moderation.reasonCodes,
          gif,
        },
      });
      await publishRoomEvent(room.slug, {
        type: "message_held",
        payload: {
          message: serializeChatMessage(message),
        },
      });
    } else {
      await appendChatArchiveEvent({
        roomId: room._id,
        eventType: "message_blocked",
        messageId: message._id,
        submissionSeq: message.submissionSeq,
        actorUserId: userId,
        payload: {
          reasonCodes: moderation.reasonCodes,
          shadowMuted,
          gif,
        },
      });
    }

    if (message.status === "blocked") {
      return NextResponse.json({ error: "message_blocked" }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: serializeChatMessage(message),
        moderationStatus: message.status,
      },
      { status: message.status === "held" ? 202 : 201 }
    );
  } catch (error) {
    console.error("[chat POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
