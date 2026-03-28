"use client";

import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatUserBadges } from "@/components/chat/chat-user-badges";
import { Modal } from "@/components/ui/modal";
import type { ChatUiCopy } from "@/lib/chat-copy";
import type { ChatOnlineUserSummary } from "@/types/chat";

interface ChatOnlineUsersModalProps {
  open: boolean;
  onClose: () => void;
  copy: ChatUiCopy;
  lang: string;
  users: ChatOnlineUserSummary[];
  loading: boolean;
  error: string | null;
}

export function ChatOnlineUsersModal({
  open,
  onClose,
  copy,
  lang,
  users,
  loading,
  error,
}: ChatOnlineUsersModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={copy.page.onlineUsersTitle} size="sm">
      {loading ? (
        <p className="text-sm text-text-secondary">{copy.page.loading}</p>
      ) : error ? (
        <div className="rounded-[12px] border border-red-500/15 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-text-secondary">{copy.page.onlineUsersEmpty}</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-white/8 bg-white/4 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChatAvatar
                  name={user.username ?? user.name}
                  src={user.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {user.username ?? user.name}
                    </p>
                    {user.profileBadges.length > 0 ? (
                      <ChatUserBadges badges={user.profileBadges} lang={lang} />
                    ) : null}
                  </div>
                </div>
              </div>
              {user.roleBadge ? (
                <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                  {user.roleBadge}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
