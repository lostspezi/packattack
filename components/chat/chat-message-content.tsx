"use client";

import { ChatMessageBody } from "@/components/chat/chat-message-body";
import { ChatMessageGif } from "@/components/chat/chat-message-gif";
import type { ChatGifSummary } from "@/types/chat";

interface ChatMessageContentProps {
  body: string;
  gif: ChatGifSummary | null;
  highlightedMentionUsername?: string | null;
  className?: string;
  bodyClassName?: string;
  gifClassName?: string;
  gifImageClassName?: string;
}

export function ChatMessageContent({
  body,
  gif,
  highlightedMentionUsername,
  className,
  bodyClassName,
  gifClassName,
  gifImageClassName,
}: ChatMessageContentProps) {
  if (!gif && !body) {
    return null;
  }

  return (
    <div className={className}>
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
