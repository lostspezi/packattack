"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatUserBadges } from "@/components/chat/chat-user-badges";
import type { ChatAuthorSummary, ChatBadgeSummary, ChatOnlineUserSummary } from "@/types/chat";

interface ChatUserCardProps {
  user: ChatAuthorSummary | ChatOnlineUserSummary | null;
  anchorRect: DOMRect | null;
  open: boolean;
  lang: string;
  labels: {
    listTitle: string;
    noBadges: string;
    verified: string;
  };
  onClose: () => void;
  onBadgeClick: (badge: ChatBadgeSummary) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ChatUserCard({
  user,
  anchorRect,
  open,
  labels,
  onClose,
  onBadgeClick,
}: ChatUserCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const cardStyle = useMemo(() => {
    if (!open || !anchorRect || typeof window === "undefined") {
      return null;
    }

    const width = 320;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const openAbove = spaceBelow < 260 && anchorRect.top > 260;

    return {
      position: "fixed" as const,
      width,
      left: clamp(anchorRect.left, 8, window.innerWidth - width - 8),
      top: openAbove ? undefined : anchorRect.bottom + 10,
      bottom: openAbove ? window.innerHeight - anchorRect.top + 10 : undefined,
      zIndex: 96,
    };
  }, [anchorRect, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (cardRef.current && !cardRef.current.contains(target)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleLayoutChange() {
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [onClose, open]);

  if (!open || !user || !cardStyle || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={cardRef}
      style={cardStyle}
      className="rounded-[18px] border border-white/10 bg-surface-elevated/98 p-4 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
      role="dialog"
      aria-modal="false"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ChatAvatar
            name={user.username ?? user.name}
            src={user.avatarUrl ?? null}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text-primary">
              {user.username ?? user.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user.roleBadge ? (
                <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                  {user.roleBadge}
                </span>
              ) : null}
              {user.identityVerified ? (
                <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                  {labels.verified}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted transition-colors hover:text-text-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-[14px] border border-white/8 bg-white/4 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          {labels.listTitle}
        </p>
        {user.profileBadges.length > 0 ? (
          <ChatUserBadges
            badges={user.profileBadges}
            iconSize="md"
            interactive
            className="mt-3"
            onBadgeClick={onBadgeClick}
          />
        ) : (
          <p className="mt-3 text-sm text-text-secondary">{labels.noBadges}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
