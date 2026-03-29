"use client";

import type { ChatGifSummary } from "@/types/chat";

interface ChatMessageGifProps {
  gif: ChatGifSummary;
  className?: string;
  imageClassName?: string;
  linkToSource?: boolean;
}

export function ChatMessageGif({
  gif,
  className,
  imageClassName,
  linkToSource = true,
}: ChatMessageGifProps) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- external GIF URLs, next/image not suitable
    <img
      src={gif.displayUrl || gif.previewUrl}
      alt={gif.title}
      loading="lazy"
      className={[
        "block h-auto w-full object-cover",
        imageClassName ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
    />
  );

  const wrapperClassName = [
    "block overflow-hidden rounded-[14px] border border-white/8 bg-black/20 transition-colors hover:border-pa-green/20",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!linkToSource) {
    return (
      <div className={wrapperClassName} title={gif.title}>
        {image}
      </div>
    );
  }

  return (
    <a
      href={gif.displayUrl}
      target="_blank"
      rel="noreferrer noopener"
      className={wrapperClassName}
      title={gif.title}
    >
      {image}
    </a>
  );
}
