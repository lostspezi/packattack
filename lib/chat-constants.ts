export const CHAT_ROOM_SLUG = "global";
export const CHAT_ROOM_TITLE = "Globaler Chat";
export const CHAT_MAX_MESSAGE_LENGTH = 500;
export const CHAT_HISTORY_PAGE_SIZE = 60;

export const CHAT_ROOM_MODES = [
  "open",
  "read_only",
  "slow_mode",
  "announcement_only",
] as const;

export const CHAT_MESSAGE_STATUSES = [
  "visible",
  "held",
  "blocked",
  "deleted",
  "redacted",
  "shadow_hidden",
] as const;

export const CHAT_SOUND_MODES = [
  "off",
  "all",
  "mentions_only",
  "mentions_and_staff",
] as const;

export const CHAT_TRUST_TIERS = ["new", "standard", "trusted", "staff"] as const;

export const CHAT_USER_STATUSES = [
  "active",
  "timed_out",
  "banned",
  "shadow_muted",
] as const;

export const CHAT_RESTRICTION_TYPES = [
  "timed_out",
  "banned",
  "shadow_muted",
] as const;

export const CHAT_ADMIN_ACTIONS = [
  "approve_message",
  "reject_message",
  "delete_message",
  "restore_message",
  "timeout_user",
  "ban_user",
  "unban_user",
  "shadow_mute_user",
  "unshadow_mute_user",
  "lift_timeout",
  "lift_ban",
  "lift_shadow_mute",
  "set_room_mode",
  "set_slow_mode",
] as const;

export const CHAT_REPORT_CATEGORIES = [
  "spam",
  "scam",
  "hate",
  "harassment",
  "sexual",
  "pii",
  "other",
] as const;

export const CHAT_ARCHIVE_EVENT_TYPES = [
  "message_submitted",
  "message_visible",
  "message_held",
  "message_blocked",
  "message_deleted",
  "message_updated",
  "message_reacted",
  "moderation_action",
  "report_created",
  "report_resolved",
  "room_updated",
] as const;

export const CHAT_STAFF_ROLES = ["moderator", "admin", "super_admin"] as const;
export const CHAT_LINK_ALLOWED_ROLES = ["admin", "super_admin"] as const;

export type ChatRoomMode = (typeof CHAT_ROOM_MODES)[number];
export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];
export type ChatSoundMode = (typeof CHAT_SOUND_MODES)[number];
export type ChatTrustTier = (typeof CHAT_TRUST_TIERS)[number];
export type ChatUserStatus = (typeof CHAT_USER_STATUSES)[number];
export type ChatRestrictionType = (typeof CHAT_RESTRICTION_TYPES)[number];
export type ChatAdminAction = (typeof CHAT_ADMIN_ACTIONS)[number];
export type ChatReportCategory = (typeof CHAT_REPORT_CATEGORIES)[number];
export type ChatReactionEmoji = string;
export type ChatArchiveEventType = (typeof CHAT_ARCHIVE_EVENT_TYPES)[number];

function normalizeRoleAlias(role?: string | null): string {
  if (!role) return "";

  const compact = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (compact === "superadmin" || compact === "super_admin") {
    return "super_admin";
  }
  return compact;
}

export function isChatAdmin(role?: string | null): boolean {
  const normalized = normalizeRoleAlias(role);
  return normalized === "admin" || normalized === "super_admin";
}

export function isChatStaff(role?: string | null): boolean {
  return CHAT_STAFF_ROLES.includes(
    normalizeRoleAlias(role) as (typeof CHAT_STAFF_ROLES)[number]
  );
}

export function canPostChatLinks(role?: string | null): boolean {
  return CHAT_LINK_ALLOWED_ROLES.includes(
    normalizeRoleAlias(role) as (typeof CHAT_LINK_ALLOWED_ROLES)[number]
  );
}

export function getChatRoleBadgeLabel(role?: string | null): string | null {
  switch (normalizeRoleAlias(role)) {
    case "admin":
    case "super_admin":
      return "ADMIN";
    case "moderator":
      return "MOD";
    case "shop":
      return "SHOP";
    default:
      return null;
  }
}
