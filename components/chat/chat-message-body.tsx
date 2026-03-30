import { Fragment } from "react";
import { escapeMentionRegex } from "@/lib/chat-mentions";
import { isChatLinkCandidate } from "@/lib/chat-links";

const LINK_PATTERN =
  /(?<!@)\b((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

function normalizeHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function splitMessageBody(body: string) {
  const segments: Array<{ text: string; href?: string }> = [];
  let lastIndex = 0;

  for (const match of body.matchAll(LINK_PATTERN)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    const cleanedMatch = rawMatch.replace(/[),.!?]+$/g, "");
    const trailing = rawMatch.slice(cleanedMatch.length);

    if (matchIndex > lastIndex) {
      segments.push({ text: body.slice(lastIndex, matchIndex) });
    }

    if (cleanedMatch.length > 0 && isChatLinkCandidate(cleanedMatch)) {
      segments.push({
        text: cleanedMatch,
        href: normalizeHref(cleanedMatch),
      });
      if (trailing.length > 0) {
        segments.push({ text: trailing });
      }
    } else {
      segments.push({ text: rawMatch });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < body.length) {
    segments.push({ text: body.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text: body }];
}

function splitTextWithHighlightedMention(text: string, username?: string | null) {
  if (!username) {
    return [{ text }];
  }

  const segments: Array<{ text: string; highlighted?: boolean }> = [];
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_-])(@${escapeMentionRegex(username)})(?=$|[^A-Za-z0-9_-])`,
    "gi"
  );
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const prefix = match[1] ?? "";
    const token = match[2] ?? "";
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex) });
    }

    if (prefix) {
      segments.push({ text: prefix });
    }

    if (token) {
      segments.push({ text: token, highlighted: true });
    }

    lastIndex = matchIndex + prefix.length + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

interface ChatMessageBodyProps {
  body: string;
  className?: string;
  highlightedMentionUsername?: string | null;
}

export function ChatMessageBody({
  body,
  className,
  highlightedMentionUsername,
}: ChatMessageBodyProps) {
  const segments = splitMessageBody(body);

  return (
    <p className={className}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment.text}-${index}`}>
          {segment.href ? (
            <a
              href={segment.href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-pa-green underline decoration-pa-green/50 underline-offset-2 transition-colors hover:text-pa-green/80"
            >
              {segment.text}
            </a>
          ) : (
            splitTextWithHighlightedMention(segment.text, highlightedMentionUsername).map(
              (part, partIndex) => (
                <Fragment key={`${part.text}-${index}-${partIndex}`}>
                  {part.highlighted ? (
                    <span className="rounded bg-pa-green/15 px-1 font-semibold text-pa-green">
                      {part.text}
                    </span>
                  ) : (
                    part.text
                  )}
                </Fragment>
              )
            )
          )}
        </Fragment>
      ))}
    </p>
  );
}
