import type { ChatMessageSummary } from "@/types/chat";

export function mergeChatMessageSummaries(
  messages: ChatMessageSummary[],
  nextMessage: ChatMessageSummary
) {
  return [...messages.filter((message) => message.id !== nextMessage.id), nextMessage].sort(
    (left, right) => {
      const leftOrder = left.visibleSeq ?? 0;
      const rightOrder = right.visibleSeq ?? 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }
  );
}
