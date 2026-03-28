"use client";

import { useMemo, useState } from "react";

interface ChatAvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}

const SIZE_CLASSES: Record<NonNullable<ChatAvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ChatAvatar({ name, src, size = "sm" }: ChatAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const sizeClass = SIZE_CLASSES[size];

  if (!src || imageFailed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 font-semibold text-text-secondary ${sizeClass}`}
        aria-hidden="true"
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`shrink-0 rounded-full border border-white/10 object-cover ${sizeClass}`}
      onError={() => setImageFailed(true)}
    />
  );
}
