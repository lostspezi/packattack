import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { Types } from "mongoose";
import { runRedisCommand } from "@/lib/redis";
import {
  canPostChatLinks,
  CHAT_HISTORY_PAGE_SIZE,
  CHAT_RESTRICTION_TYPES,
  CHAT_ROOM_SLUG,
  CHAT_ROOM_TITLE,
  getChatRoleBadgeLabel,
  isChatStaff,
  type ChatRestrictionType,
  type ChatSoundMode,
  type ChatTrustTier,
} from "@/lib/chat-constants";
import { toMentionTargetSummary } from "@/lib/chat-mentions";
import { resolveChatModerationProvider } from "@/lib/chat-moderation";
import type {
  ChatActionLogResponse,
  ChatActiveRestrictionSummary,
  ChatAdminOverviewResponse,
  ChatEventEnvelope,
  ChatMessageSummary,
  ChatModeratedUserSummary,
  ChatModerationActionSummary,
  ChatOverviewResponse,
  ChatReadStateSummary,
  ChatReportSummary,
  ChatRestrictionCounts,
  ChatRestrictionsResponse,
  ChatRoomSummary,
  ChatUserPermissions,
  ChatUserSearchResponse,
} from "@/types/chat";
import ChatArchiveEvent from "@/models/chat-archive-event";
import ChatMessage, { type IChatMessage } from "@/models/chat-message";
import ChatModerationAction, {
  type IChatModerationAction,
} from "@/models/chat-moderation-action";
import ChatPolicyConfig from "@/models/chat-policy-config";
import ChatReadState from "@/models/chat-read-state";
import ChatReport from "@/models/chat-report";
import ChatRoom, { type IChatRoom } from "@/models/chat-room";
import ChatUserState, { type IChatUserState } from "@/models/chat-user-state";
import User from "@/models/user";

interface ChatUserLike {
  _id: Types.ObjectId | { toString(): string } | string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  image?: string | null;
  identityVerified?: boolean;
  emailVerified?: Date | null;
  badges?: Array<{
    key: string;
    label: string;
    active?: boolean;
    tone?: "neutral" | "green" | "gold" | "lilac" | "blue";
    expiresAt?: Date | null;
    sortOrder?: number;
  }>;
  createdAt?: Date;
}

const CHAT_PRESENCE_STALE_MS = 90_000;
const CHAT_RESTRICTION_ACTION_TYPES = [
  "timeout_user",
  "lift_timeout",
  "ban_user",
  "lift_ban",
  "shadow_mute_user",
  "lift_shadow_mute",
] as const;

function roomChannel(slug = CHAT_ROOM_SLUG) {
  return `chat:room:${slug}`;
}

function userChannel(userId: string) {
  return `chat:user:${userId}`;
}

function presenceUsersKey(slug = CHAT_ROOM_SLUG) {
  return `chat:presence:${slug}:users`;
}

function presenceTouchedKey(slug = CHAT_ROOM_SLUG) {
  return `chat:presence:${slug}:touched`;
}

function toStringId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    return value.toString();
  }
  return "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toProfileBadges(user: ChatUserLike | null | undefined) {
  return (user?.badges ?? [])
    .filter((badge) => badge.active !== false)
    .filter((badge) => !badge.expiresAt || badge.expiresAt.getTime() > Date.now())
    .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))
    .map((badge) => ({
      key: badge.key,
      label: badge.label,
      tone: badge.tone ?? "neutral",
    }));
}

function getDisplayName(user: Pick<ChatUserLike, "name" | "username"> | null | undefined) {
  return user?.name ?? user?.username ?? "Nutzer";
}

function getChatRestrictionCountsFromStates(states: Array<Pick<IChatUserState, "activeRestriction">>): ChatRestrictionCounts {
  const counts: ChatRestrictionCounts = {
    total: 0,
    timedOut: 0,
    banned: 0,
    shadowMuted: 0,
  };

  for (const state of states) {
    const type = state.activeRestriction?.type;
    if (!type) continue;
    counts.total += 1;
    if (type === "timed_out") counts.timedOut += 1;
    if (type === "banned") counts.banned += 1;
    if (type === "shadow_muted") counts.shadowMuted += 1;
  }

  return counts;
}

async function pruneChatPresence(redis: Redis, slug: string) {
  const staleBefore = Date.now() - CHAT_PRESENCE_STALE_MS;
  const staleConnectionIds = await redis.zrangebyscore(
    presenceTouchedKey(slug),
    0,
    staleBefore
  );

  if (staleConnectionIds.length > 0) {
    await redis.zrem(presenceTouchedKey(slug), ...staleConnectionIds);
    await redis.hdel(presenceUsersKey(slug), ...staleConnectionIds);
  }

  const activeUsers = await redis.hvals(presenceUsersKey(slug));
  return new Set(activeUsers.filter(Boolean)).size;
}

function serializeChatActiveRestriction(input: {
  userState: IChatUserState;
  user: ChatUserLike | null | undefined;
}): ChatActiveRestrictionSummary | null {
  const restriction = input.userState.activeRestriction;
  if (!restriction) {
    return null;
  }

  return {
    userId: toStringId(input.userState.userId),
    name: getDisplayName(input.user),
    username: input.user?.username ?? null,
    email: input.user?.email ?? null,
    restrictionType: restriction.type,
    reason: restriction.reason ?? null,
    imposedBy: restriction.actorName ?? null,
    imposedByUserId: restriction.actorUserId ? toStringId(restriction.actorUserId) : null,
    imposedAt: restriction.imposedAt ? restriction.imposedAt.toISOString() : null,
    expiresAt: restriction.expiresAt ? restriction.expiresAt.toISOString() : null,
    sourceMessageId: restriction.sourceMessageId ? toStringId(restriction.sourceMessageId) : null,
    sourceMessageBody: restriction.sourceMessageBody ?? null,
    sourceVisibleSeq: restriction.sourceVisibleSeq ?? null,
  };
}

async function fetchUsersMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ChatUserLike>();
  }

  const users = await User.find({ _id: { $in: userIds } }, "name username email role image identityVerified emailVerified badges createdAt")
    .lean();

  return new Map(users.map((user) => [toStringId(user._id), user as ChatUserLike]));
}

async function normalizeExpiredChatState(userState: IChatUserState) {
  const expiresAt = userState.activeRestriction?.expiresAt ?? userState.timeoutUntil;
  const timeoutExpired =
    userState.chatStatus === "timed_out" &&
    expiresAt &&
    expiresAt.getTime() <= Date.now();

  if (!timeoutExpired) {
    return userState;
  }

  userState.chatStatus = "active";
  userState.timeoutUntil = null;
  userState.activeRestriction = null;
  await userState.save();
  return userState;
}

async function backfillLegacyRestrictionState(userState: IChatUserState) {
  if (userState.activeRestriction) {
    return userState;
  }

  let type: ChatRestrictionType | null = null;
  if (
    userState.chatStatus === "timed_out" &&
    userState.timeoutUntil &&
    userState.timeoutUntil.getTime() > Date.now()
  ) {
    type = "timed_out";
  } else if (userState.chatStatus === "banned") {
    type = "banned";
  } else if (userState.chatStatus === "shadow_muted") {
    type = "shadow_muted";
  }

  if (!type) {
    return userState;
  }

  const lastActionType =
    type === "timed_out"
      ? "timeout_user"
      : type === "banned"
        ? "ban_user"
        : "shadow_mute_user";

  const lastAction = await ChatModerationAction.findOne({
    targetUserId: userState.userId,
    actionType: lastActionType,
  })
    .sort({ createdAt: -1 })
    .lean();

  userState.activeRestriction = {
    type,
    reason: userState.banReason ?? lastAction?.reasonText ?? null,
    sourceMessageId: lastAction?.sourceMessageSnapshot?.messageId ?? null,
    sourceMessageBody: lastAction?.sourceMessageSnapshot?.body ?? null,
    sourceVisibleSeq: lastAction?.sourceMessageSnapshot?.visibleSeq ?? null,
    actorUserId: lastAction?.actorUserId ?? null,
    actorName: lastAction?.actorSnapshot?.name ?? null,
    imposedAt: lastAction?.createdAt ?? userState.updatedAt ?? new Date(),
    expiresAt:
      type === "timed_out"
        ? userState.timeoutUntil ?? lastAction?.expiresAt ?? null
        : null,
  };
  await userState.save();
  return userState;
}

async function backfillLegacyRestrictions() {
  const legacyStates = await ChatUserState.find({
    activeRestriction: null,
    $or: [
      { chatStatus: "banned" },
      { chatStatus: "shadow_muted" },
      { chatStatus: "timed_out", timeoutUntil: { $gt: new Date() } },
    ],
  });

  await Promise.all(legacyStates.map((state) => backfillLegacyRestrictionState(state)));
}

export function buildChatAuthorSnapshot(user: ChatUserLike | null | undefined) {
  if (!user) return null;

  return {
    id: toStringId(user._id),
    name: getDisplayName(user),
    username: user.username ?? null,
    role: user.role ?? "user",
    roleBadge: getChatRoleBadgeLabel(user.role),
    profileBadges: toProfileBadges(user),
    avatarUrl: user.image ?? null,
    identityVerified: Boolean(user.identityVerified),
  };
}

function getMessageBody(message: Pick<IChatMessage, "status" | "bodyDisplay">): string {
  if (message.status === "deleted" || message.status === "redacted") {
    return "Nachricht entfernt";
  }
  if (message.status === "held") {
    return "Nachricht wird geprüft";
  }
  return message.bodyDisplay;
}

export function serializeChatMessage(message: IChatMessage): ChatMessageSummary {
  return {
    id: message._id.toString(),
    roomSlug: message.roomSlug,
    submissionSeq: message.submissionSeq,
    visibleSeq: message.visibleSeq ?? null,
    body: getMessageBody(message),
    status: message.status,
    author: message.authorSnapshot
      ? {
          id: toStringId(message.authorUserId),
          name: message.authorSnapshot.name,
          username: message.authorSnapshot.username,
          role: message.authorSnapshot.role,
          roleBadge: message.authorSnapshot.roleBadge,
          profileBadges: message.authorSnapshot.profileBadges,
          avatarUrl: message.authorSnapshot.avatarUrl,
          identityVerified: message.authorSnapshot.identityVerified,
        }
      : null,
    mentionTargets: (message.mentionTargets ?? []).map((target) => toMentionTargetSummary(target)),
    hasLink: message.hasLink,
    hasMention: message.hasMention,
    isDeleted: message.status === "deleted" || message.status === "redacted",
    deletedReason: message.deleteReason ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function serializeChatReadState(readState: {
  muted: boolean;
  soundMode: ChatSoundMode;
  browserNotifications: boolean;
  lastReadVisibleSeq: number;
}): ChatReadStateSummary {
  return {
    muted: readState.muted,
    soundMode: readState.soundMode,
    browserNotifications: readState.browserNotifications,
    lastReadVisibleSeq: readState.lastReadVisibleSeq,
  };
}

export function serializeChatRoom(room: IChatRoom, onlineCount: number): ChatRoomSummary {
  return {
    id: room._id.toString(),
    slug: room.slug,
    title: room.title,
    mode: room.mode,
    slowModeSeconds: room.slowModeSeconds,
    onlineCount,
    lastVisibleSeq: room.visibleSeq,
    rulesVersion: room.rulesVersion,
  };
}

export function serializeChatReport(report: {
  _id: Types.ObjectId;
  messageId: Types.ObjectId;
  reporterUserId: Types.ObjectId | { name?: string | null };
  category: ChatReportSummary["category"];
  note?: string | null;
  status: ChatReportSummary["status"];
  createdAt: Date;
}): ChatReportSummary {
  const reporter = report.reporterUserId as Types.ObjectId & { name?: string | null };

  return {
    id: report._id.toString(),
    messageId: report.messageId.toString(),
    reporterUserId: toStringId(report.reporterUserId),
    reporterName: reporter?.name ?? "Nutzer",
    category: report.category,
    note: report.note ?? null,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  };
}

export function serializeChatAction(action: IChatModerationAction): ChatModerationActionSummary {
  return {
    id: action._id.toString(),
    actionType: action.actionType,
    targetUserId: action.targetUserId ? action.targetUserId.toString() : null,
    targetMessageId: action.targetMessageId ? action.targetMessageId.toString() : null,
    actorName: action.actorSnapshot.name,
    actorUsername: action.actorSnapshot.username ?? null,
    targetUserName: action.targetUserSnapshot?.name ?? null,
    targetUserUsername: action.targetUserSnapshot?.username ?? null,
    targetUserEmail: action.targetUserSnapshot?.email ?? null,
    reason: action.reasonText ?? null,
    expiresAt: action.expiresAt ? action.expiresAt.toISOString() : null,
    sourceMessageId: action.sourceMessageSnapshot?.messageId
      ? action.sourceMessageSnapshot.messageId.toString()
      : null,
    sourceMessageBody: action.sourceMessageSnapshot?.body ?? null,
    sourceVisibleSeq: action.sourceMessageSnapshot?.visibleSeq ?? null,
    reversalOfActionId: action.reversalOfActionId ? action.reversalOfActionId.toString() : null,
    createdAt: action.createdAt.toISOString(),
  };
}

export async function expireStaleChatTimeouts() {
  const now = new Date();

  await ChatUserState.updateMany(
    {
      chatStatus: "timed_out",
      $or: [
        { timeoutUntil: { $lte: now } },
        { "activeRestriction.expiresAt": { $lte: now } },
      ],
    },
    {
      $set: {
        chatStatus: "active",
        timeoutUntil: null,
        activeRestriction: null,
      },
    }
  );
}

export async function ensureGlobalChatRoom(): Promise<IChatRoom> {
  const room = await ChatRoom.findOneAndUpdate(
    { slug: CHAT_ROOM_SLUG },
    {
      $setOnInsert: {
        slug: CHAT_ROOM_SLUG,
        title: CHAT_ROOM_TITLE,
        description: "Der öffentliche Live-Chat für alle verifizierten Nutzer und Admins.",
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!room) {
    throw new Error("Failed to ensure chat room");
  }

  return room;
}

export async function ensureGlobalChatPolicy() {
  const provider = resolveChatModerationProvider();

  const policy = await ChatPolicyConfig.findOneAndUpdate(
    { roomSlug: CHAT_ROOM_SLUG },
    {
      $set: {
        provider,
      },
      $setOnInsert: {
        roomSlug: CHAT_ROOM_SLUG,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!policy) {
    throw new Error("Failed to ensure chat policy");
  }

  return policy;
}

function resolveTrustTier(user: ChatUserLike, existing?: IChatUserState | null): ChatTrustTier {
  if (isChatStaff(user.role)) return "staff";
  if (existing?.trustTier === "trusted") return "trusted";
  if (existing?.trustTier === "standard") return "standard";
  if (user.createdAt && Date.now() - user.createdAt.getTime() > 14 * 24 * 60 * 60 * 1000) {
    return "standard";
  }
  return "new";
}

export async function ensureChatUserState(user: ChatUserLike) {
  const existing = await ChatUserState.findOne({ userId: user._id });
  const trustTier = resolveTrustTier(user, existing);

  const userState = await ChatUserState.findOneAndUpdate(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
      },
      $set: {
        trustTier,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!userState) {
    throw new Error("Failed to ensure chat user state");
  }

  await normalizeExpiredChatState(userState);
  return backfillLegacyRestrictionState(userState);
}

export async function ensureChatReadState(roomId: Types.ObjectId, userId: string | Types.ObjectId) {
  const readState = await ChatReadState.findOneAndUpdate(
    { roomId, userId },
    {
      $setOnInsert: {
        roomId,
        userId,
      },
      $set: {
        lastConnectedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!readState) {
    throw new Error("Failed to ensure chat read state");
  }

  return readState;
}

export function buildChatPermissions(input: {
  user: ChatUserLike;
  room: IChatRoom;
  userState: IChatUserState;
  moderationReady: boolean;
}): ChatUserPermissions {
  const { user, room, userState, moderationReady } = input;
  const isStaff = isChatStaff(user.role);
  const requiresVerifiedEmail = room.requireEmailVerifiedToPost && !isStaff;
  const timeoutUntil = userState.activeRestriction?.type === "timed_out"
    ? userState.activeRestriction.expiresAt
    : userState.timeoutUntil;
  const timeoutActive = Boolean(timeoutUntil && timeoutUntil.getTime() > Date.now());
  const banned =
    userState.chatStatus === "banned" || userState.activeRestriction?.type === "banned";

  const canPostBase =
    (!requiresVerifiedEmail || Boolean(user.emailVerified)) &&
    !timeoutActive &&
    !banned &&
    (moderationReady || isStaff);

  let canPost = canPostBase;
  if (room.mode === "read_only") canPost = false;
  if (room.mode === "announcement_only" && !isStaff) canPost = false;

  return {
    canPost,
    canPostLinks: canPostChatLinks(user.role),
    requiresEmailVerification: requiresVerifiedEmail,
    moderationReady,
    timeoutUntil: timeoutActive && timeoutUntil ? timeoutUntil.toISOString() : null,
    chatStatus: banned ? "banned" : timeoutActive ? "timed_out" : userState.chatStatus,
    trustTier: userState.trustTier,
  };
}

export async function getChatOnlineCount(slug = CHAT_ROOM_SLUG): Promise<number> {
  return runRedisCommand<number>(
    `chat:presence-count:${slug}`,
    0,
    async (redis) => pruneChatPresence(redis, slug)
  );
}

export async function addChatPresence(
  slug: string,
  userId: string,
  connectionId: string
): Promise<number> {
  return runRedisCommand<number>(
    `chat:presence-add:${slug}`,
    0,
    async (redis) => {
      const now = Date.now();
      await redis.hset(presenceUsersKey(slug), connectionId, userId);
      await redis.zadd(presenceTouchedKey(slug), now, connectionId);
      return pruneChatPresence(redis, slug);
    }
  );
}

export async function touchChatPresence(
  slug: string,
  userId: string,
  connectionId: string
): Promise<number> {
  return runRedisCommand<number>(
    `chat:presence-touch:${slug}`,
    0,
    async (redis) => {
      const now = Date.now();
      await redis.hset(presenceUsersKey(slug), connectionId, userId);
      await redis.zadd(presenceTouchedKey(slug), now, connectionId);
      return pruneChatPresence(redis, slug);
    }
  );
}

export async function removeChatPresence(slug: string, connectionId: string): Promise<number> {
  return runRedisCommand<number>(
    `chat:presence-remove:${slug}`,
    0,
    async (redis) => {
      await redis.hdel(presenceUsersKey(slug), connectionId);
      await redis.zrem(presenceTouchedKey(slug), connectionId);
      return pruneChatPresence(redis, slug);
    }
  );
}

export async function publishRoomEvent<T>(slug: string, event: ChatEventEnvelope<T>): Promise<void> {
  await runRedisCommand<void>(
    `chat:publish-room:${slug}`,
    undefined,
    async (redis) => {
      await redis.publish(roomChannel(slug), JSON.stringify(event));
    }
  );
}

export async function publishUserEvent<T>(userId: string, event: ChatEventEnvelope<T>): Promise<void> {
  await runRedisCommand<void>(
    `chat:publish-user:${userId}`,
    undefined,
    async (redis) => {
      await redis.publish(userChannel(userId), JSON.stringify(event));
    }
  );
}

export async function appendChatArchiveEvent(input: {
  roomId: Types.ObjectId;
  roomSlug?: string;
  eventType: Parameters<typeof ChatArchiveEvent.create>[0]["eventType"];
  messageId?: Types.ObjectId | null;
  submissionSeq?: number | null;
  actorUserId?: Types.ObjectId | string | null;
  payload: Record<string, unknown>;
}) {
  await ChatArchiveEvent.create({
    roomId: input.roomId,
    roomSlug: input.roomSlug ?? CHAT_ROOM_SLUG,
    eventType: input.eventType,
    messageId: input.messageId ?? null,
    submissionSeq: input.submissionSeq ?? null,
    actorUserId: input.actorUserId ? new Types.ObjectId(input.actorUserId) : null,
    payload: input.payload,
  });
}

export async function fetchVisibleMessages(
  roomId: Types.ObjectId,
  beforeVisibleSeq?: number,
  limit = CHAT_HISTORY_PAGE_SIZE,
  options: { includeRemoved?: boolean } = {}
) {
  const query: Record<string, unknown> = {
    roomId,
    status: options.includeRemoved ? { $in: ["visible", "deleted", "redacted"] } : "visible",
  };

  if (beforeVisibleSeq) {
    query.visibleSeq = { $lt: beforeVisibleSeq };
  }

  const messages = await ChatMessage.find(query).sort({ visibleSeq: -1 }).limit(limit).lean();
  return messages.reverse();
}

export async function fetchHeldMessages(roomId: Types.ObjectId) {
  return ChatMessage.find({ roomId, status: "held" }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function fetchOpenReports(roomId: Types.ObjectId) {
  return ChatReport.find({ roomId, status: "open" })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("reporterUserId", "name")
    .lean();
}

export async function fetchActionLog(input: {
  roomId: Types.ObjectId;
  page?: number;
  limit?: number;
  target?: string;
  actor?: string;
  actionType?: ChatModerationActionSummary["actionType"];
  from?: Date;
  to?: Date;
  restrictionOnly?: boolean;
}): Promise<ChatActionLogResponse> {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {
    roomId: input.roomId,
  };

  if (input.actionType) {
    query.actionType = input.actionType;
  } else if (input.restrictionOnly !== false) {
    query.actionType = { $in: [...CHAT_RESTRICTION_ACTION_TYPES] };
  }

  if (input.from || input.to) {
    query.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  if (input.target?.trim()) {
    const targetRegex = new RegExp(escapeRegex(input.target.trim()), "i");
    query.$or = [
      { "targetUserSnapshot.name": targetRegex },
      { "targetUserSnapshot.username": targetRegex },
      { "targetUserSnapshot.email": targetRegex },
      { "sourceMessageSnapshot.body": targetRegex },
    ];
  }

  if (input.actor?.trim()) {
    const actorRegex = new RegExp(escapeRegex(input.actor.trim()), "i");
    const actorFilter = {
      $or: [{ "actorSnapshot.name": actorRegex }, { "actorSnapshot.username": actorRegex }],
    };

    if (query.$or) {
      query.$and = [{ $or: query.$or }, actorFilter];
      delete query.$or;
    } else {
      Object.assign(query, actorFilter);
    }
  }

  const [total, actions] = await Promise.all([
    ChatModerationAction.countDocuments(query),
    ChatModerationAction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return {
    total,
    actions: actions.map((action) => serializeChatAction(action as IChatModerationAction)),
  };
}

export async function fetchActiveRestrictions(input: {
  status?: ChatRestrictionType;
  page?: number;
  limit?: number;
} = {}): Promise<ChatRestrictionsResponse> {
  await expireStaleChatTimeouts();
  await backfillLegacyRestrictions();

  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {
    "activeRestriction.type": input.status ?? { $in: CHAT_RESTRICTION_TYPES },
  };

  const [states, total, countStates] = await Promise.all([
    ChatUserState.find(query)
      .sort({ "activeRestriction.imposedAt": -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatUserState.countDocuments(query),
    ChatUserState.find({ "activeRestriction.type": { $in: CHAT_RESTRICTION_TYPES } }, "activeRestriction").lean(),
  ]);

  const usersMap = await fetchUsersMap(states.map((state) => toStringId(state.userId)));

  return {
    total,
    counts: getChatRestrictionCountsFromStates(countStates),
    restrictions: states
      .map((state) =>
        serializeChatActiveRestriction({
          userState: state as IChatUserState,
          user: usersMap.get(toStringId(state.userId)),
        })
      )
      .filter((item): item is ChatActiveRestrictionSummary => Boolean(item)),
  };
}

export async function fetchModeratedUsers(queryText: string): Promise<ChatUserSearchResponse> {
  await expireStaleChatTimeouts();

  const search = queryText.trim();
  if (!search) {
    return { users: [] };
  }

  const regex = new RegExp(escapeRegex(search), "i");
  const users = await User.find(
    {
      $or: [{ name: regex }, { username: regex }, { email: regex }],
    },
    "name username email role image identityVerified emailVerified badges createdAt"
  )
    .sort({ name: 1, username: 1 })
    .limit(12)
    .lean();

  const results = await Promise.all(
    users.map(async (user) => {
      const [userState, recentMessages, recentActions] = await Promise.all([
        ensureChatUserState(user as ChatUserLike),
        ChatMessage.find({ authorUserId: user._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        ChatModerationAction.find({ targetUserId: user._id })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);

      return {
        userId: toStringId(user._id),
        name: getDisplayName(user),
        username: user.username ?? null,
        email: user.email ?? null,
        role: user.role ?? "user",
        chatStatus: userState.chatStatus,
        activeRestriction: serializeChatActiveRestriction({
          userState,
          user: user as ChatUserLike,
        }),
        recentMessages: recentMessages.map((message) =>
          serializeChatMessage(message as IChatMessage)
        ),
        recentActions: recentActions.map((action) =>
          serializeChatAction(action as IChatModerationAction)
        ),
      } satisfies ChatModeratedUserSummary;
    })
  );

  return { users: results };
}

export async function touchChatReadState(
  roomId: Types.ObjectId,
  userId: string,
  lastReadVisibleSeq: number
) {
  return ChatReadState.findOneAndUpdate(
    { roomId, userId },
    {
      $set: {
        lastReadVisibleSeq,
        lastSeenVisibleSeq: lastReadVisibleSeq,
      },
    },
    { returnDocument: "after" }
  );
}

export async function updateChatPreferences(
  roomId: Types.ObjectId,
  userId: string,
  input: {
    muted?: boolean;
    soundMode?: ChatSoundMode;
    browserNotifications?: boolean;
  }
) {
  return ChatReadState.findOneAndUpdate(
    { roomId, userId },
    {
      $set: {
        ...(typeof input.muted === "boolean" ? { muted: input.muted } : {}),
        ...(input.soundMode ? { soundMode: input.soundMode } : {}),
        ...(typeof input.browserNotifications === "boolean"
          ? { browserNotifications: input.browserNotifications }
          : {}),
      },
    },
    { returnDocument: "after" }
  );
}

export async function buildChatOverviewForUser(
  user: ChatUserLike,
  options: { includeRemoved?: boolean } = {}
): Promise<ChatOverviewResponse> {
  await expireStaleChatTimeouts();

  const room = await ensureGlobalChatRoom();
  const policy = await ensureGlobalChatPolicy();
  const userState = await ensureChatUserState(user);
  const readState = await ensureChatReadState(room._id, toStringId(user._id));

  const [messages, onlineCount] = await Promise.all([
    fetchVisibleMessages(room._id, undefined, CHAT_HISTORY_PAGE_SIZE, {
      includeRemoved: options.includeRemoved,
    }),
    getChatOnlineCount(room.slug),
  ]);

  return {
    room: serializeChatRoom(room, onlineCount),
    messages: messages.map((message) =>
      serializeChatMessage(message as unknown as IChatMessage)
    ),
    readState: serializeChatReadState(readState),
    permissions: buildChatPermissions({
      user,
      room,
      userState,
      moderationReady: policy.provider !== "none",
    }),
    selfUsername: user.username ?? null,
  };
}

export async function buildChatAdminOverview(user: ChatUserLike): Promise<ChatAdminOverviewResponse> {
  const base = await buildChatOverviewForUser(user, { includeRemoved: true });
  const room = await ensureGlobalChatRoom();

  const [heldMessages, reports, actions, restrictions] = await Promise.all([
    fetchHeldMessages(room._id),
    fetchOpenReports(room._id),
    fetchActionLog({ roomId: room._id, limit: 20, restrictionOnly: true }),
    fetchActiveRestrictions({ limit: 12 }),
  ]);

  return {
    ...base,
    heldMessages: heldMessages.map((message) =>
      serializeChatMessage(message as unknown as IChatMessage)
    ),
    reports: reports.map((report) => serializeChatReport(report as never)),
    actions: actions.actions,
    restrictions: restrictions.restrictions,
    restrictionCounts: restrictions.counts,
  };
}

export async function publishRoomState(room: IChatRoom) {
  const onlineCount = await getChatOnlineCount(room.slug);
  await publishRoomEvent(room.slug, {
    type: "room_state",
    payload: {
      room: serializeChatRoom(room, onlineCount),
    },
  });
}

export function createChatConnectionId() {
  return randomUUID();
}

export function getChatRoomRedisChannel(slug = CHAT_ROOM_SLUG) {
  return roomChannel(slug);
}

export function getChatUserRedisChannel(userId: string) {
  return userChannel(userId);
}
