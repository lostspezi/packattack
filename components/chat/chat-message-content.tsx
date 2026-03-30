"use client";

import { ChatMessageBody } from "@/components/chat/chat-message-body";
import { ChatMessageGif } from "@/components/chat/chat-message-gif";
import { ChatJackpotCard } from "@/components/chat/chat-jackpot-card";
import type { ChatGifSummary, ChatHighlightCardSummary } from "@/types/chat";

interface ChatMessageContentProps {
  body: string;
  gif: ChatGifSummary | null;
  highlightCard?: ChatHighlightCardSummary | null;
  highlightedMentionUsername?: string | null;
  className?: string;
  bodyClassName?: string;
  gifClassName?: string;
  gifImageClassName?: string;
}

export function ChatMessageContent({
  body,
  gif,
  highlightCard,
  highlightedMentionUsername,
  className,
  bodyClassName,
  gifClassName,
  gifImageClassName,
}: ChatMessageContentProps) {
  if (!gif && !body && !highlightCard) {
    return null;
  }

  return (
    <div className={className}>
      {highlightCard ? <ChatJackpotCard card={highlightCard} className="mb-2" /> : null}
      {gif ? (
        <ChatMessageGif
          gif={gif}
          className={gifClassName}
          imageClassName={gifImageClassName}
        />
      ) : null}
      {body ? (
        <ChatMessageBody
          body={body}
          highlightedMentionUsername={highlightedMentionUsername}
          className={bodyClassName}
        />
      ) : null}
    </div>
  );
}
