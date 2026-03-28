"use client";

import type { ChatMentionCandidateSummary } from "@/types/chat";

interface MentionSuggestionsProps {
  users: ChatMentionCandidateSummary[];
  activeIndex: number;
  onSelect: (user: ChatMentionCandidateSummary) => void;
}

export function MentionSuggestions({
  users,
  activeIndex,
  onSelect,
}: MentionSuggestionsProps) {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-[14px] border border-white/10 bg-surface-elevated/95 shadow-2xl backdrop-blur">
      <div className="max-h-56 overflow-y-auto py-2">
        {users.map((user, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={user.userId}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(user);
              }}
              className={[
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                active ? "bg-pa-green/10 text-text-primary" : "text-text-secondary hover:bg-white/5",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">@{user.username}</p>
                <p className="truncate text-xs text-text-muted">{user.name}</p>
              </div>
              {user.roleBadge ? (
                <span className="shrink-0 rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                  {user.roleBadge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
