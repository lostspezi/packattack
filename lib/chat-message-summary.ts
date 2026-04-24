import type { ChatMessageSummary } from "@/types/chat";
import { CHAT_CLIENT_BUFFER_LIMIT } from "./chat-constants";

function compareForOrder(left: ChatMessageSummary, right: ChatMessageSummary): number {
  const leftOrder = left.visibleSeq ?? 0;
  const rightOrder = right.visibleSeq ?? 0;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

export function mergeChatMessageSummaries(
  messages: ChatMessageSummary[],
  nextMessage: ChatMessageSummary,
  limit: number = CHAT_CLIENT_BUFFER_LIMIT,
): ChatMessageSummary[] {
  const present = messages.some((message) => message.id === nextMessage.id);
  // Updates for messages already evicted by the cap would otherwise be
  // re-inserted as if brand new and push out a genuinely recent message.
  // If the buffer is full and the incoming message is older than the oldest
  // kept one, drop it on the floor.
  if (!present && messages.length >= limit && messages.length > 0) {
    if (compareForOrder(nextMessage, messages[0]) < 0) {
      return messages;
    }
  }
  const merged = [
    ...messages.filter((message) => message.id !== nextMessage.id),
    nextMessage,
  ].sort(compareForOrder);
  return merged.length > limit ? merged.slice(merged.length - limit) : merged;
}

export function capChatMessageSummaries(
  messages: ChatMessageSummary[],
  limit: number = CHAT_CLIENT_BUFFER_LIMIT,
): ChatMessageSummary[] {
  if (messages.length <= limit) return messages;
  const sorted = [...messages].sort(compareForOrder);
  return sorted.slice(sorted.length - limit);
}
