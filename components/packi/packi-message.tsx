"use client";

import { renderPackiMarkdown } from "@/lib/packi/markdown";

interface PackiMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function PackiMessageBubble({
  role,
  content,
  streaming,
}: PackiMessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={[
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-pa-green text-black rounded-br-sm"
            : "bg-surface-elevated text-text-primary border border-border rounded-bl-sm",
        ].join(" ")}
      >
        {isUser ? (
          content
        ) : (
          <>
            {renderPackiMarkdown(content)}
            {streaming && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-text-muted align-middle"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
