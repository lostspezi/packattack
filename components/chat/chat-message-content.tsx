"use client";

import { ChatMessageBody } from "@/components/chat/chat-message-body";
import { ChatMessageGif } from "@/components/chat/chat-message-gif";
import { ChatJackpotCard } from "@/components/chat/chat-jackpot-card";
import { ChatBattleInvite } from "@/components/chat/chat-battle-invite";
import { ChatGodpackHighlight } from "@/components/chat/chat-godpack-highlight";
import type {
  ChatBattleInviteSummary,
  ChatGifSummary,
  ChatGodpackHighlightSummary,
  ChatHighlightCardSummary,
  ChatQuotedMessageSummary,
} from "@/types/chat";

interface ChatMessageContentProps {
  body: string;
  gif: ChatGifSummary | null;
  highlightCard?: ChatHighlightCardSummary | null;
  godpackHighlight?: ChatGodpackHighlightSummary | null;
  battleInvite?: ChatBattleInviteSummary | null;
  quotedMessage?: ChatQuotedMessageSummary | null;
  quoteLabels?: {
    replyingTo: string;
    gifFallback: string;
  };
  highlightedMentionUsername?: string | null;
  lang?: string;
  className?: string;
  bodyClassName?: string;
  gifClassName?: string;
  gifImageClassName?: string;
}

export function ChatMessageContent({
  body,
  gif,
  highlightCard,
  godpackHighlight,
  battleInvite,
  quotedMessage,
  quoteLabels,
  highlightedMentionUsername,
  lang,
  className,
  bodyClassName,
  gifClassName,
  gifImageClassName,
}: ChatMessageContentProps) {
  if (!gif && !body && !highlightCard && !godpackHighlight && !battleInvite && !quotedMessage) {
    return null;
  }

  const quoteBody = quotedMessage?.body?.trim() ?? "";
  const quoteSourceText = quoteBody || quoteLabels?.gifFallback || "GIF";
  const quotePreview =
    quoteSourceText.length > 180 ? `${quoteSourceText.slice(0, 180)}...` : quoteSourceText;

  return (
    <div className={className}>
      {quotedMessage ? (
        <div className="mb-2 rounded-[10px] border border-white/10 bg-white/4 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {quoteLabels?.replyingTo ?? "Replying to"}{" "}
            <span className="normal-case">
              {quotedMessage.authorUsername
                ? `@${quotedMessage.authorUsername}`
                : quotedMessage.authorName}
            </span>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-text-secondary">
            {quotePreview}
          </p>
        </div>
      ) : null}
      {godpackHighlight ? (
        <ChatGodpackHighlight highlight={godpackHighlight} className="mb-2" />
      ) : null}
      {highlightCard ? <ChatJackpotCard card={highlightCard} className="mb-2" /> : null}
      {battleInvite ? <ChatBattleInvite invite={battleInvite} lang={lang ?? "de"} className="mb-2" /> : null}
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
