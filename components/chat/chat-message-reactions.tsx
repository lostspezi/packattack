"use client";

import type { CSSProperties } from "react";
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
import { getChatEmojiData } from "@/lib/chat-emoji-data";
import type { ChatReactionSummary } from "@/types/chat";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const PICKER_EMOJI_STYLE = "native" as PickerProps["emojiStyle"];
const PICKER_THEME = "dark" as PickerProps["theme"];
const PICKER_MAX_WIDTH = 336;
const PICKER_MAX_HEIGHT = 408;
const PICKER_GAP = 10;
const CHAT_REACTION_SKIN_TONE_STORAGE_KEY = "packattack.chat.reactions.skinTone";
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
  };
  disabled?: boolean;
  onToggle?: (emoji: ChatReactionSummary["emoji"]) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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

    updatePosition();
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

  const hasControls = Boolean(onToggle) && !disabled;
  const emojiData = useMemo(
    () => getChatEmojiData(lang) as PickerProps["emojiData"],
    [lang]
  );

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

  return (
    <div ref={containerRef} className="mt-3 flex flex-wrap items-center gap-2">
      {reactions.map((reaction) => {
        const active = reaction.userIds.includes(currentUserId);
        const clickable = Boolean(onToggle) && !disabled;

        return (
          <button
            key={reaction.emoji}
            type="button"
            disabled={!clickable}
            onClick={() => onToggle?.(reaction.emoji)}
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              clickable ? "" : "cursor-default",
              active
                ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                : "border-white/8 bg-white/4 text-text-secondary hover:text-text-primary",
              !clickable ? "opacity-100" : "",
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
    </div>
  );
}
