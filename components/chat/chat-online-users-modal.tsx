"use client";

import { useEffect, useState } from "react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatBadgeDetailModal } from "@/components/chat/chat-badge-detail-modal";
import { ChatUserCard } from "@/components/chat/chat-user-card";
import { ChatUserBadges } from "@/components/chat/chat-user-badges";
import { Modal } from "@/components/ui/modal";
import type { ChatUiCopy } from "@/lib/chat-copy";
import type { ChatBadgeSummary, ChatOnlineUserSummary } from "@/types/chat";

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
  const [activeUserCard, setActiveUserCard] = useState<{
    user: ChatOnlineUserSummary;
    rect: DOMRect;
  } | null>(null);
  const [activeBadge, setActiveBadge] = useState<ChatBadgeSummary | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- resetting child state when modal closes */
  useEffect(() => {
    if (!open) {
      setActiveUserCard(null);
      setActiveBadge(null);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
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
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) =>
                      setActiveUserCard({
                        user,
                        rect: event.currentTarget.getBoundingClientRect(),
                      })
                    }
                    className="flex min-w-0 items-center gap-3 rounded-[12px] text-left outline-none transition-colors hover:text-pa-green focus-visible:text-pa-green"
                  >
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
                        {user.roleBadge ? (
                          <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                            {user.roleBadge}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                  {user.profileBadges.length > 0 ? (
                    <ChatUserBadges badges={user.profileBadges} lang={lang} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ChatUserCard
        open={activeUserCard !== null}
        user={activeUserCard?.user ?? null}
        anchorRect={activeUserCard?.rect ?? null}
        lang={lang}
        labels={{
          listTitle: copy.badges.listTitle,
          noBadges: copy.badges.noBadges,
          verified: copy.badges.verified,
        }}
        onClose={() => setActiveUserCard(null)}
        onBadgeClick={(badge) => {
          setActiveUserCard(null);
          setActiveBadge(badge);
        }}
      />

      <ChatBadgeDetailModal
        open={activeBadge !== null}
        badge={activeBadge}
        lang={lang}
        labels={{
          awardedAt: copy.badges.awardedAt,
          reason: copy.badges.reason,
        }}
        onClose={() => setActiveBadge(null)}
      />
    </>
  );
}
