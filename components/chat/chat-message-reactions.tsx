"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import {
  Clock3,
  Flag,
  Gamepad2,
  Leaf,
  Package2,
  Plane,
  Sandwich,
  Smile,
  Sparkles,
} from "lucide-react";
import {
  Categories,
  SkinTonePickerLocation,
  SkinTones,
  SuggestionMode,
} from "emoji-picker-react";
import type { EmojiClickData, PickerProps } from "emoji-picker-react";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { Modal } from "@/components/ui/modal";
import { getChatEmojiData } from "@/lib/chat-emoji-data";
import type { ChatReactionSummary, ChatReactionUserSummary } from "@/types/chat";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const PICKER_EMOJI_STYLE = "native" as PickerProps["emojiStyle"];
const PICKER_THEME = "dark" as PickerProps["theme"];
const PICKER_MAX_WIDTH = 336;
const PICKER_MAX_HEIGHT = 408;
const PICKER_GAP = 10;
const CHAT_REACTION_SKIN_TONE_STORAGE_KEY = "packattack.chat.reactions.skinTone";
const TOOLTIP_MAX_WIDTH = 320;
const CONTEXT_MENU_WIDTH = 208;

const PICKER_CATEGORY_ICONS: PickerProps["categoryIcons"] = {
  [Categories.SUGGESTED]: <Clock3 className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.SMILEYS_PEOPLE]: <Smile className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.ANIMALS_NATURE]: <Leaf className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.FOOD_DRINK]: <Sandwich className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.TRAVEL_PLACES]: <Plane className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.ACTIVITIES]: <Gamepad2 className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.OBJECTS]: <Package2 className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.SYMBOLS]: <Sparkles className="h-4 w-4" strokeWidth={1.85} />,
  [Categories.FLAGS]: <Flag className="h-4 w-4" strokeWidth={1.85} />,
};

const PICKER_STYLE = {
  "--epr-bg-color": "rgba(34, 33, 49, 0.96)",
  "--epr-picker-border-color": "rgba(255, 255, 255, 0.08)",
  "--epr-text-color": "var(--color-text-secondary)",
  "--epr-search-input-bg-color": "rgba(255, 255, 255, 0.04)",
  "--epr-search-input-bg-color-active": "rgba(255, 255, 255, 0.06)",
  "--epr-search-border-color": "rgba(255, 255, 255, 0.08)",
  "--epr-search-border-color-active": "rgba(155, 255, 0, 0.34)",
  "--epr-search-input-text-color": "var(--color-text-primary)",
  "--epr-search-input-placeholder-color": "var(--color-text-muted)",
  "--epr-highlight-color": "var(--color-pa-green)",
  "--epr-hover-bg-color": "rgba(155, 255, 0, 0.1)",
  "--epr-hover-bg-color-reduced-opacity": "rgba(155, 255, 0, 0.08)",
  "--epr-focus-bg-color": "rgba(155, 255, 0, 0.14)",
  "--epr-category-icon-active-color": "var(--color-pa-green)",
  "--epr-category-label-bg-color": "rgba(34, 33, 49, 0.9)",
  "--epr-category-label-text-color": "var(--color-text-muted)",
  "--epr-reactions-bg-color": "transparent",
  "--epr-horizontal-padding": "14px",
  "--epr-header-padding": "14px 14px 10px",
  "--epr-picker-border-radius": "18px",
  "--epr-search-input-border-radius": "12px",
  "--epr-search-input-height": "42px",
  "--epr-search-input-padding": "0 38px",
  "--epr-search-bar-inner-padding": "0",
  "--epr-category-navigation-button-size": "34px",
  "--epr-category-padding": "0 14px",
  "--epr-category-label-padding": "0 14px",
  "--epr-category-label-height": "30px",
  "--epr-emoji-size": "28px",
  "--epr-emoji-padding": "6px",
  "--epr-emoji-hover-color": "rgba(255, 255, 255, 0.06)",
  "--epr-emoji-variation-picker-bg-color": "rgba(26, 25, 36, 0.96)",
  "--epr-skin-tone-picker-menu-color": "rgba(26, 25, 36, 0.94)",
  "--epr-skin-tone-outer-border-color": "rgba(255, 255, 255, 0.08)",
  "--epr-skin-tone-inner-border-color": "rgba(34, 33, 49, 0.96)",
} as CSSProperties;

interface ChatMessageReactionsProps {
  reactions: ChatReactionSummary[];
  currentUserId: string;
  lang?: string;
  labels: {
    add: string;
    reactWith: string;
    view: string;
    viewerTitle: string;
    viewerEmpty: string;
    tooltipReactedBy: string;
    tooltipAndOthers: string;
  };
  disabled?: boolean;
  onToggle?: (emoji: ChatReactionSummary["emoji"]) => void;
}

interface ReactionHoverState {
  emoji: string;
  rect: DOMRect;
}

interface ReactionContextMenuState {
  emoji: string;
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function replaceCountToken(template: string, count: number) {
  return template.replace("{count}", String(count));
}

function getStoredSkinTone() {
  if (typeof window === "undefined") {
    return SkinTones.NEUTRAL;
  }

  try {
    const storedValue = window.localStorage.getItem(CHAT_REACTION_SKIN_TONE_STORAGE_KEY);
    if (storedValue && Object.values(SkinTones).includes(storedValue as SkinTones)) {
      return storedValue as SkinTones;
    }
  } catch {
    // Ignore local storage failures and use the default tone.
  }

  return SkinTones.NEUTRAL;
}

function getReactionPrimaryLabel(user: ChatReactionUserSummary) {
  return user.username ?? user.name;
}

function getReactionSecondaryLabel(user: ChatReactionUserSummary) {
  return user.username ? `@${user.username}` : null;
}

function getReactionTooltipText(
  reaction: ChatReactionSummary,
  labels: ChatMessageReactionsProps["labels"]
) {
  const names = reaction.reactors.map((user) => getReactionPrimaryLabel(user)).filter(Boolean);
  const visibleNames = names.slice(0, 3);
  const remaining = reaction.count - visibleNames.length;

  if (visibleNames.length === 0) {
    return `${reaction.count}`;
  }

  if (remaining <= 0) {
    return `${labels.tooltipReactedBy} ${visibleNames.join(", ")}`;
  }

  return `${labels.tooltipReactedBy} ${visibleNames.join(", ")} ${replaceCountToken(
    labels.tooltipAndOthers,
    remaining
  )}`;
}

function getTooltipStyle(rect: DOMRect): CSSProperties | null {
  if (typeof window === "undefined") {
    return null;
  }

  const tooltipWidth = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - 16);
  const preferredTop = rect.top - 12;
  const openAbove = preferredTop > 84;

  return {
    position: "fixed",
    width: tooltipWidth,
    left: clamp(rect.left + rect.width / 2 - tooltipWidth / 2, 8, window.innerWidth - tooltipWidth - 8),
    top: openAbove ? undefined : rect.bottom + 12,
    bottom: openAbove ? window.innerHeight - rect.top + 12 : undefined,
    zIndex: 96,
  };
}

function getContextMenuStyle(menu: ReactionContextMenuState): CSSProperties | null {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    position: "fixed",
    width: CONTEXT_MENU_WIDTH,
    left: clamp(menu.x, 8, window.innerWidth - CONTEXT_MENU_WIDTH - 8),
    top: clamp(menu.y, 8, window.innerHeight - 56),
    zIndex: 97,
  };
}

export function ChatMessageReactions({
  reactions,
  currentUserId,
  lang = "de",
  labels,
  disabled = false,
  onToggle,
}: ChatMessageReactionsProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const [pickerSize, setPickerSize] = useState({ width: PICKER_MAX_WIDTH, height: PICKER_MAX_HEIGHT });
  const [defaultSkinTone, setDefaultSkinTone] = useState<SkinTones>(getStoredSkinTone);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionHoverState | null>(null);
  const [contextMenu, setContextMenu] = useState<ReactionContextMenuState | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const hasControls = Boolean(onToggle) && !disabled;
  const emojiData = useMemo(
    () => getChatEmojiData(lang) as PickerProps["emojiData"],
    [lang]
  );
  const selectedReaction = useMemo(
    () =>
      selectedReactionEmoji
        ? reactions.find((reaction) => reaction.emoji === selectedReactionEmoji) ?? null
        : reactions[0] ?? null,
    [reactions, selectedReactionEmoji]
  );
  const hoveredReactionSummary = useMemo(
    () =>
      hoveredReaction
        ? reactions.find((reaction) => reaction.emoji === hoveredReaction.emoji) ?? null
        : null,
    [hoveredReaction, reactions]
  );

  function updatePosition() {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const pickerWidth = Math.min(PICKER_MAX_WIDTH, window.innerWidth - 16);
    const pickerHeight = Math.min(PICKER_MAX_HEIGHT, window.innerHeight - 24);
    const shouldOpenUpward =
      window.innerHeight - rect.bottom < pickerHeight + PICKER_GAP &&
      rect.top > pickerHeight + PICKER_GAP;
    const left = Math.min(
      window.innerWidth - pickerWidth - 8,
      Math.max(8, rect.right - pickerWidth + 18)
    );

    setPickerSize({
      width: pickerWidth,
      height: pickerHeight,
    });

    setDropdownStyle({
      position: "fixed",
      left,
      width: pickerWidth,
      zIndex: 95,
      ...(shouldOpenUpward
        ? { bottom: window.innerHeight - rect.top + PICKER_GAP }
        : { top: rect.bottom + PICKER_GAP }),
    });
  }

  function openReactionViewer(emoji: string) {
    setSelectedReactionEmoji(emoji);
    setViewerOpen(true);
    setContextMenu(null);
    setHoveredReaction(null);
  }

  function closeReactionViewer() {
    setViewerOpen(false);
  }

  function handleReactionContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    emoji: string
  ) {
    event.preventDefault();
    setHoveredReaction(null);
    setOpen(false);
    setContextMenu({
      emoji,
      x: event.clientX,
      y: event.clientY,
    });
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const frame = window.requestAnimationFrame(updatePosition);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!contextMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!hoveredReaction && !contextMenu) return;

    function clearFloatingUi() {
      setHoveredReaction(null);
      setContextMenu(null);
    }

    window.addEventListener("resize", clearFloatingUi);
    window.addEventListener("scroll", clearFloatingUi, true);

    return () => {
      window.removeEventListener("resize", clearFloatingUi);
      window.removeEventListener("scroll", clearFloatingUi, true);
    };
  }, [contextMenu, hoveredReaction]);

  useEffect(() => {
    if (reactions.length === 0) {
      queueMicrotask(() => {
        setHoveredReaction(null);
        setContextMenu(null);
        setSelectedReactionEmoji(null);
        setViewerOpen(false);
      });
      return;
    }

    if (hoveredReaction && !reactions.some((reaction) => reaction.emoji === hoveredReaction.emoji)) {
      queueMicrotask(() => setHoveredReaction(null));
    }

    if (contextMenu && !reactions.some((reaction) => reaction.emoji === contextMenu.emoji)) {
      queueMicrotask(() => setContextMenu(null));
    }

    if (!selectedReactionEmoji) {
      return;
    }

    if (!reactions.some((reaction) => reaction.emoji === selectedReactionEmoji)) {
      queueMicrotask(() => setSelectedReactionEmoji(reactions[0]?.emoji ?? null));
    }
  }, [contextMenu, hoveredReaction, reactions, selectedReactionEmoji]);

  if (reactions.length === 0 && !hasControls) {
    return null;
  }

  const picker =
    open && hasControls && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={pickerRef}
            style={dropdownStyle}
            className="z-[95] overflow-hidden rounded-[18px] border border-white/10 bg-surface-elevated/98 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
          >
            <EmojiPicker
              className="packattack-emoji-picker"
              emojiData={emojiData}
              categoryIcons={PICKER_CATEGORY_ICONS}
              emojiStyle={PICKER_EMOJI_STYLE}
              suggestedEmojisMode={SuggestionMode.FREQUENT}
              skinTonePickerLocation={SkinTonePickerLocation.SEARCH}
              defaultSkinTone={defaultSkinTone}
              theme={PICKER_THEME}
              width={pickerSize.width}
              height={pickerSize.height}
              lazyLoadEmojis
              style={PICKER_STYLE}
              searchPlaceholder={lang === "de" ? "Emoji suchen" : "Search emoji"}
              searchClearButtonLabel={lang === "de" ? "Suche löschen" : "Clear search"}
              previewConfig={{ showPreview: false }}
              onSkinToneChange={(nextSkinTone) => {
                setDefaultSkinTone(nextSkinTone);

                try {
                  window.localStorage.setItem(
                    CHAT_REACTION_SKIN_TONE_STORAGE_KEY,
                    nextSkinTone
                  );
                } catch {
                  // Ignore local storage failures and keep the in-memory tone.
                }
              }}
              onEmojiClick={(emojiData: EmojiClickData) => {
                onToggle?.(emojiData.emoji);
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )
      : null;

  const tooltip =
    hoveredReaction && hoveredReactionSummary && !contextMenu && !viewerOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            style={getTooltipStyle(hoveredReaction.rect) ?? undefined}
            className="pointer-events-none rounded-[16px] border border-white/10 bg-surface-elevated/96 px-3.5 py-3 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <span className="text-[28px] leading-none">{hoveredReactionSummary.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5 text-text-primary">
                  {getReactionTooltipText(hoveredReactionSummary, labels)}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const contextMenuPortal =
    contextMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={contextMenuRef}
            style={getContextMenuStyle(contextMenu) ?? undefined}
            className="overflow-hidden rounded-[14px] border border-white/10 bg-surface-elevated/98 p-1.5 shadow-2xl shadow-black/35 ring-1 ring-white/8 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => openReactionViewer(contextMenu.emoji)}
              className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-white/5 hover:text-pa-green"
            >
              <span>{labels.view}</span>
              <span className="text-base leading-none">{contextMenu.emoji}</span>
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={containerRef} className="mt-3 flex flex-wrap items-center gap-2">
        {reactions.map((reaction) => {
          const active = reaction.userIds.includes(currentUserId);
          const clickable = Boolean(onToggle) && !disabled;

          return (
            <button
              key={reaction.emoji}
              type="button"
              aria-pressed={clickable ? active : undefined}
              aria-haspopup="menu"
              onClick={() => {
                if (clickable) {
                  onToggle?.(reaction.emoji);
                }
              }}
              onContextMenu={(event) => handleReactionContextMenu(event, reaction.emoji)}
              onMouseEnter={(event) => {
                setHoveredReaction({
                  emoji: reaction.emoji,
                  rect: event.currentTarget.getBoundingClientRect(),
                });
              }}
              onMouseLeave={() => {
                setHoveredReaction((current) =>
                  current?.emoji === reaction.emoji ? null : current
                );
              }}
              onFocus={(event) => {
                setHoveredReaction({
                  emoji: reaction.emoji,
                  rect: event.currentTarget.getBoundingClientRect(),
                });
              }}
              onBlur={() => {
                setHoveredReaction((current) =>
                  current?.emoji === reaction.emoji ? null : current
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoveredReaction(null);
                  setContextMenu({
                    emoji: reaction.emoji,
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 8,
                  });
                }
              }}
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                clickable ? "" : "cursor-default",
                active
                  ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                  : "border-white/8 bg-white/4 text-text-secondary hover:border-white/12 hover:bg-white/6 hover:text-text-primary",
              ].join(" ")}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          );
        })}

        {hasControls ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-6 w-6 items-center justify-center text-text-muted transition-colors hover:text-pa-green"
            aria-expanded={open}
            aria-label={labels.add}
            title={labels.add}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {picker}
        {tooltip}
        {contextMenuPortal}
      </div>

      <Modal open={viewerOpen} onClose={closeReactionViewer} title={labels.viewerTitle} size="xl">
        <div className="grid gap-5 md:grid-cols-[168px_minmax(0,1fr)]">
          <div className="space-y-2 md:border-r md:border-white/8 md:pr-4">
            {reactions.map((reaction) => {
              const active = reaction.emoji === selectedReaction?.emoji;
              return (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => setSelectedReactionEmoji(reaction.emoji)}
                  className={[
                    "flex w-full items-center justify-between rounded-[12px] border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    active
                      ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                      : "border-white/8 bg-white/4 text-text-secondary hover:border-white/12 hover:text-text-primary",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl leading-none">{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            {selectedReaction && selectedReaction.reactors.length > 0 ? (
              <div className="space-y-2">
                {selectedReaction.reactors.map((user) => {
                  const secondaryLabel = getReactionSecondaryLabel(user);
                  const active = user.id === currentUserId;

                  return (
                    <div
                      key={`${selectedReaction.emoji}:${user.id}`}
                      className={[
                        "flex items-center gap-3 rounded-[14px] border px-3 py-3",
                        active
                          ? "border-pa-green/15 bg-pa-green/6"
                          : "border-white/8 bg-white/4",
                      ].join(" ")}
                    >
                      <ChatAvatar
                        name={user.name}
                        src={user.avatarUrl ?? null}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {user.name}
                        </p>
                        {secondaryLabel ? (
                          <p className="truncate text-sm text-text-muted">{secondaryLabel}</p>
                        ) : (
                          <p className="truncate text-sm text-text-muted">
                            {getReactionPrimaryLabel(user)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[14px] border border-white/8 bg-white/4 px-4 py-6 text-sm text-text-secondary">
                {labels.viewerEmpty}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
