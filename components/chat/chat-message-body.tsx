import { Fragment } from "react";

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

    if (cleanedMatch.length > 0) {
      segments.push({
        text: cleanedMatch,
        href: normalizeHref(cleanedMatch),
      });
    }

    if (trailing.length > 0) {
      segments.push({ text: trailing });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < body.length) {
    segments.push({ text: body.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text: body }];
}

interface ChatMessageBodyProps {
  body: string;
  className?: string;
}

export function ChatMessageBody({ body, className }: ChatMessageBodyProps) {
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
            segment.text
          )}
        </Fragment>
      ))}
    </p>
  );
}
