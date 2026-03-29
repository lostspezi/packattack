import emojiRegex from "emoji-regex/RGI_Emoji";
import { isKnownChatEmojiValue } from "@/lib/chat-emoji-data";

export const CHAT_MAX_REACTION_EMOJI_LENGTH = 64;

export function isSupportedChatReactionEmoji(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CHAT_MAX_REACTION_EMOJI_LENGTH) {
    return false;
  }

  if (countGraphemeClusters(trimmed) !== 1) {
    return false;
  }

  if (isKnownChatEmojiValue(trimmed)) {
    return true;
  }

  const matches = trimmed.match(emojiRegex()) ?? [];
  return matches.length > 0 && matches.join("") === trimmed;
}

function countGraphemeClusters(value: string) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value))
      .length;
  }

  return Array.from(value).length;
}
