import type { Types } from "mongoose";

const MENTION_SEARCH_PATTERN = /(^|[\s(])@([A-Za-z0-9_-]{0,32})$/;
const MENTION_EXTRACT_PATTERN = /(^|[\s(])@([A-Za-z0-9_-]{3,32})(?=$|[\s).,!?;:[\]{}])/g;

export interface ChatMentionQuery {
  start: number;
  end: number;
  query: string;
}

export interface ChatMentionTargetInput {
  _id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  name?: string | null;
  username?: string | null;
}

export function escapeMentionRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMentionUsernames(body: string) {
  const matches = new Map<string, string>();

  for (const match of body.matchAll(MENTION_EXTRACT_PATTERN)) {
    const username = match[2];
    if (!username) continue;
    const normalized = username.toLowerCase();
    if (!matches.has(normalized)) {
      matches.set(normalized, username);
    }
  }

  return [...matches.values()];
}

export function findMentionQuery(body: string, caretPosition: number): ChatMentionQuery | null {
  const clampedCaret = Math.max(0, Math.min(body.length, caretPosition));
  const beforeCaret = body.slice(0, clampedCaret);
  const match = beforeCaret.match(MENTION_SEARCH_PATTERN);

  if (!match) {
    return null;
  }

  const query = match[2] ?? "";
  const start = clampedCaret - query.length - 1;
  let end = clampedCaret;

  while (end < body.length && /[A-Za-z0-9_-]/.test(body[end] ?? "")) {
    end += 1;
  }

  return {
    start,
    end,
    query,
  };
}

export function insertMentionAtRange(
  body: string,
  range: Pick<ChatMentionQuery, "start" | "end">,
  username: string
) {
  const before = body.slice(0, range.start);
  const after = body.slice(range.end);
  const shouldAddSpace = after.length === 0 || !/^[\s).,!?;:[\]{}]/.test(after);
  const inserted = `@${username}${shouldAddSpace ? " " : ""}`;
  const value = `${before}${inserted}${after}`;
  const punctuationOffset = !shouldAddSpace && /^[).,!?;:[\]{}]/.test(after) ? 1 : 0;

  return {
    value,
    caretPosition: before.length + inserted.length + punctuationOffset,
  };
}

export function toMentionTargetSummary(user: ChatMentionTargetInput) {
  return {
    userId: String(user.userId ?? user._id ?? ""),
    username: user.username ?? null,
    name: user.name?.trim() || user.username || "Nutzer",
  };
}
