"use client";

import { X } from "lucide-react";
import { ChatMessageGif } from "@/components/chat/chat-message-gif";
import type { ChatUiCopy } from "@/lib/chat-copy";
import type { ChatGifSummary } from "@/types/chat";

interface ChatGifAttachmentPreviewProps {
  gif: ChatGifSummary;
  copy: ChatUiCopy;
  onRemove: () => void;
}

export function ChatGifAttachmentPreview({
  gif,
  copy,
  onRemove,
}: ChatGifAttachmentPreviewProps) {
  return (
    <div className="mb-3 rounded-[14px] border border-white/8 bg-white/4 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {copy.gifs.attached}
          </p>
          <p className="truncate text-sm text-text-primary">{gif.title}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-muted transition-colors hover:text-pa-green"
          title={copy.gifs.removeAttachment}
          aria-label={copy.gifs.removeAttachment}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ChatMessageGif
        gif={gif}
        className="max-w-[240px]"
        imageClassName="max-h-[180px]"
      />
    </div>
  );
}
