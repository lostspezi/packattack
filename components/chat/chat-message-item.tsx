"use client";

import { memo } from "react";
import { Flag, MoreHorizontal, Reply } from "lucide-react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { ChatMessageReactions } from "@/components/chat/chat-message-reactions";
import { ChatUserBadges } from "@/components/chat/chat-user-badges";
import { Dropdown } from "@/components/ui/dropdown";
import { isChatAdmin } from "@/lib/chat-constants";
import { getChatUiCopy } from "@/lib/chat-i18n";
import type {
  ChatAuthorSummary,
  ChatMessageSummary,
  ChatOnlineUserSummary,
} from "@/types/chat";

type ChatCopy = ReturnType<typeof getChatUiCopy>;

export type QuickModerationAction =
  | "delete_message"
  | "restore_message"
  | "timeout_user"
  | "ban_user";

export function canEditOwnAdminMessage(
  message: ChatMessageSummary,
  currentUserId: string,
) {
  return (
    !message.isDeleted &&
    message.author?.id === currentUserId &&
    isChatAdmin(message.author?.role)
  );
}

export function isProtectedModerationTarget(
  message: ChatMessageSummary,
  currentUserId: string,
) {
  return (
    message.author?.id === currentUserId ||
    message.author?.role === "admin" ||
    message.author?.role === "super_admin" ||
    message.author?.role === "moderator"
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface ChatMessageItemProps {
  message: ChatMessageSummary;
  mentionedCurrentUser: boolean;
  pendingReaction: boolean;
  isStaff: boolean;
  canPost: boolean;
  currentUserId: string;
  selfUsername: string | null;
  lang: string;
  copy: ChatCopy;
  onOpenUserCard: (
    user: ChatAuthorSummary | ChatOnlineUserSummary | null | undefined,
    target: HTMLElement,
  ) => void;
  onQuote: (message: ChatMessageSummary) => void;
  onEditOwn: (message: ChatMessageSummary) => void;
  onModerationAction: (
    action: QuickModerationAction,
    message: ChatMessageSummary,
  ) => void;
  onReport: (message: ChatMessageSummary) => void;
  onToggleReaction: (
    messageId: string,
    emoji: ChatMessageSummary["reactions"][number]["emoji"],
  ) => void;
}

function ChatMessageItemImpl({
  message,
  mentionedCurrentUser,
  pendingReaction,
  isStaff,
  canPost,
  currentUserId,
  selfUsername,
  lang,
  copy,
  onOpenUserCard,
  onQuote,
  onEditOwn,
  onModerationAction,
  onReport,
  onToggleReaction,
}: ChatMessageItemProps) {
  return (
    <div
      className={`rounded-[16px] border p-3 ${
        mentionedCurrentUser && !message.isDeleted
          ? "border-pa-green/20 bg-pa-green/8 ring-1 ring-pa-green/10"
          : "border-white/7 bg-black/12"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {message.author ? (
            <>
              <button
                type="button"
                onClick={(event) => onOpenUserCard(message.author, event.currentTarget)}
                className="flex min-w-0 items-center gap-3 rounded-[12px] text-left outline-none transition-colors hover:text-pa-green focus-visible:text-pa-green"
              >
                <ChatAvatar
                  name={message.author.username ?? message.author.name ?? "System"}
                  src={message.author.avatarUrl ?? null}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {message.author.username ?? message.author.name ?? "System"}
                    </span>
                    {message.author.roleBadge ? (
                      <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                        {message.author.roleBadge}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
              {message.author.profileBadges.length ? (
                <ChatUserBadges badges={message.author.profileBadges} lang={lang} />
              ) : null}
            </>
          ) : (
            <div className="min-w-0">
              <span className="text-sm font-semibold text-text-primary">System</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <time title={new Date(message.createdAt).toLocaleString("de-DE")}>
            {formatTime(message.createdAt)}
          </time>
          {!message.isDeleted ? (
            <button
              type="button"
              onClick={() => onQuote(message)}
              className="inline-flex items-center text-text-muted transition-colors hover:text-pa-green"
              aria-label={copy.quote.action}
              title={copy.quote.action}
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {isStaff ? (
            <Dropdown
              align="right"
              side="auto"
              minWidth={180}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-muted transition-colors hover:text-pa-green"
                  aria-label={copy.admin.quickActions}
                  title={copy.admin.quickActions}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              }
              items={[
                ...(canEditOwnAdminMessage(message, currentUserId)
                  ? [
                      {
                        label: copy.messageEditor.edit,
                        value: `edit:${message.id}`,
                        onClick: () => onEditOwn(message),
                      },
                    ]
                  : []),
                ...(message.isDeleted
                  ? [
                      {
                        label: copy.admin.restore,
                        value: `restore:${message.id}`,
                        onClick: () => onModerationAction("restore_message", message),
                      },
                    ]
                  : [
                      {
                        label: copy.admin.delete,
                        value: `delete:${message.id}`,
                        onClick: () => onModerationAction("delete_message", message),
                      },
                    ]),
                ...(message.author?.id &&
                !isProtectedModerationTarget(message, currentUserId) &&
                !message.isDeleted
                  ? [
                      {
                        label: copy.admin.timeout,
                        value: `timeout:${message.id}`,
                        onClick: () => onModerationAction("timeout_user", message),
                      },
                      {
                        label: copy.admin.ban,
                        value: `ban:${message.id}`,
                        onClick: () => onModerationAction("ban_user", message),
                      },
                    ]
                  : []),
              ]}
            />
          ) : !message.isDeleted && message.author?.id !== currentUserId ? (
            <button
              type="button"
              onClick={() => onReport(message)}
              className="inline-flex items-center text-text-muted transition-colors hover:text-pa-green"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <ChatMessageContent
        body={message.body}
        gif={message.gif}
        highlightCard={message.highlightCard}
        battleInvite={message.battleInvite}
        quotedMessage={message.quotedMessage}
        quoteLabels={{
          replyingTo: copy.quote.replyingTo,
          gifFallback: copy.quote.gifFallback,
        }}
        highlightedMentionUsername={mentionedCurrentUser ? selfUsername : null}
        lang={lang}
        className="mt-2 space-y-2"
        gifClassName="max-w-[220px]"
        gifImageClassName="max-h-[220px]"
        bodyClassName={`whitespace-pre-wrap break-words text-sm ${message.isDeleted ? "italic text-text-muted" : "text-text-primary"}`}
      />
      {!message.isDeleted ? (
        <ChatMessageReactions
          lang={lang}
          reactions={message.reactions}
          currentUserId={currentUserId}
          disabled={pendingReaction}
          onToggle={
            canPost
              ? (emoji) => {
                  onToggleReaction(message.id, emoji);
                }
              : undefined
          }
          labels={copy.reactions}
        />
      ) : null}
    </div>
  );
}

export const ChatMessageItem = memo(ChatMessageItemImpl);
