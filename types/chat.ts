import type {
  ChatAdminAction,
  ChatArchiveEventType,
  ChatMessageStatus,
  ChatReportCategory,
  ChatRestrictionType,
  ChatRoomMode,
  ChatSoundMode,
  ChatTrustTier,
  ChatUserStatus,
} from "@/lib/chat-constants";

export interface ChatBadgeSummary {
  key: string;
  label: string;
  tone: "neutral" | "green" | "gold" | "lilac" | "blue";
}

export interface ChatMentionTargetSummary {
  userId: string;
  username: string | null;
  name: string;
}

export interface ChatMentionCandidateSummary {
  userId: string;
  username: string;
  name: string;
  role: string;
  roleBadge: string | null;
}

export interface ChatAuthorSummary {
  id: string;
  name: string;
  username: string | null;
  role: string;
  roleBadge: string | null;
  profileBadges: ChatBadgeSummary[];
  avatarUrl: string | null;
  identityVerified: boolean;
}

export interface ChatOnlineUserSummary {
  id: string;
  name: string;
  username: string | null;
  role: string;
  roleBadge: string | null;
  profileBadges: ChatBadgeSummary[];
  avatarUrl: string | null;
  identityVerified: boolean;
}

export interface ChatMessageSummary {
  id: string;
  roomSlug: string;
  submissionSeq: number;
  visibleSeq: number | null;
  body: string;
  status: ChatMessageStatus;
  author: ChatAuthorSummary | null;
  mentionTargets: ChatMentionTargetSummary[];
  hasLink: boolean;
  hasMention: boolean;
  isDeleted: boolean;
  deletedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReadStateSummary {
  muted: boolean;
  soundMode: ChatSoundMode;
  browserNotifications: boolean;
  lastReadVisibleSeq: number;
}

export interface ChatRoomSummary {
  id: string;
  slug: string;
  title: string;
  mode: ChatRoomMode;
  slowModeSeconds: number;
  onlineCount: number;
  lastVisibleSeq: number;
  rulesVersion: number;
}

export interface ChatUserPermissions {
  canPost: boolean;
  canPostLinks: boolean;
  requiresEmailVerification: boolean;
  moderationReady: boolean;
  timeoutUntil: string | null;
  chatStatus: ChatUserStatus;
  trustTier: ChatTrustTier;
}

export interface ChatOverviewResponse {
  room: ChatRoomSummary;
  messages: ChatMessageSummary[];
  readState: ChatReadStateSummary;
  permissions: ChatUserPermissions;
  selfUsername: string | null;
}

export interface ChatMentionSearchResponse {
  users: ChatMentionCandidateSummary[];
}

export interface ChatOnlineUsersResponse {
  total: number;
  users: ChatOnlineUserSummary[];
}

export interface ChatReportSummary {
  id: string;
  messageId: string;
  reporterUserId: string;
  reporterName: string;
  category: ChatReportCategory;
  note: string | null;
  status: "open" | "dismissed" | "actioned";
  createdAt: string;
}

export interface ChatModerationActionSummary {
  id: string;
  actionType: ChatAdminAction;
  targetUserId: string | null;
  targetMessageId: string | null;
  actorName: string;
  actorUsername: string | null;
  targetUserName: string | null;
  targetUserUsername: string | null;
  targetUserEmail: string | null;
  reason: string | null;
  expiresAt: string | null;
  sourceMessageId: string | null;
  sourceMessageBody: string | null;
  sourceVisibleSeq: number | null;
  reversalOfActionId: string | null;
  createdAt: string;
}

export interface ChatRestrictionCounts {
  total: number;
  timedOut: number;
  banned: number;
  shadowMuted: number;
}

export interface ChatActiveRestrictionSummary {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  restrictionType: ChatRestrictionType;
  reason: string | null;
  imposedBy: string | null;
  imposedByUserId: string | null;
  imposedAt: string | null;
  expiresAt: string | null;
  sourceMessageId: string | null;
  sourceMessageBody: string | null;
  sourceVisibleSeq: number | null;
}

export interface ChatModeratedUserSummary {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  chatStatus: ChatUserStatus;
  activeRestriction: ChatActiveRestrictionSummary | null;
  recentMessages: ChatMessageSummary[];
  recentActions: ChatModerationActionSummary[];
}

export interface ChatAdminOverviewResponse extends ChatOverviewResponse {
  heldMessages: ChatMessageSummary[];
  reports: ChatReportSummary[];
  actions: ChatModerationActionSummary[];
  restrictions: ChatActiveRestrictionSummary[];
  restrictionCounts: ChatRestrictionCounts;
}

export interface ChatRestrictionsResponse {
  restrictions: ChatActiveRestrictionSummary[];
  counts: ChatRestrictionCounts;
  total: number;
}

export interface ChatUserSearchResponse {
  users: ChatModeratedUserSummary[];
}

export interface ChatActionLogResponse {
  actions: ChatModerationActionSummary[];
  total: number;
}

export interface ChatArchiveEventSummary {
  id: string;
  eventType: ChatArchiveEventType;
  messageId: string | null;
  createdAt: string;
}

export interface ChatEventEnvelope<T = Record<string, unknown>> {
  type:
    | "message_created"
    | "message_removed"
    | "message_held"
    | "moderation_updated"
    | "room_state"
    | "read_state"
    | "user_notice";
  payload: T;
}
