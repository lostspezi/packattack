import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

// Markdown subset supported: **bold**, *italic*, [text](url), - list items.
// Links are only emitted for relative hrefs starting with "/". Anything else
// is rendered as plain text — defense-in-depth against phishing/exfil.

const LINK_PATTERN = /\[([^\]\n]+?)\]\((\/[^)\s]*)\)/g;
const BOLD_PATTERN = /\*\*([^*\n]+?)\*\*/g;
const ITALIC_PATTERN = /(^|[^*])\*([^*\n]+?)\*(?!\*)/g;

interface Token {
  type: "text" | "bold" | "italic" | "link";
  content: string;
  href?: string;
}

function tokenizeInline(line: string): Token[] {
  const matches: Array<{
    start: number;
    end: number;
    token: Token;
  }> = [];

  for (const match of line.matchAll(LINK_PATTERN)) {
    matches.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      token: { type: "link", content: match[1], href: match[2] },
    });
  }
  for (const match of line.matchAll(BOLD_PATTERN)) {
    matches.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      token: { type: "bold", content: match[1] },
    });
  }
  for (const match of line.matchAll(ITALIC_PATTERN)) {
    const offset = match[1].length;
    matches.push({
      start: (match.index ?? 0) + offset,
      end: (match.index ?? 0) + match[0].length,
      token: { type: "italic", content: match[2] },
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start < lastEnd) continue; // overlapping — keep the earlier match
    if (m.start > cursor) {
      tokens.push({ type: "text", content: line.slice(cursor, m.start) });
    }
    tokens.push(m.token);
    cursor = m.end;
    lastEnd = m.end;
  }
  if (cursor < line.length) {
    tokens.push({ type: "text", content: line.slice(cursor) });
  }
  return tokens;
}

function renderTokens(tokens: Token[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case "bold":
        return createElement("strong", { key }, token.content);
      case "italic":
        return createElement("em", { key }, token.content);
      case "link":
        return createElement(
          "a",
          {
            key,
            href: token.href,
            className: "text-pa-green underline underline-offset-2",
          },
          token.content,
        );
      case "text":
      default:
        return createElement(Fragment, { key }, token.content);
    }
  });
}

export function renderPackiMarkdown(
  source: string,
  keyPrefix = "md",
): ReactNode {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, idx) =>
      createElement(
        "li",
        { key: `${keyPrefix}-li-${blocks.length}-${idx}` },
        renderTokens(tokenizeInline(item), `${keyPrefix}-li-${blocks.length}-${idx}`),
      ),
    );
    blocks.push(
      createElement(
        "ul",
        {
          key: `${keyPrefix}-ul-${blocks.length}`,
          className: "list-disc pl-5 space-y-1",
        },
        items,
      ),
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      return;
    }
    flushList();
    blocks.push(
      createElement(
        "p",
        { key: `${keyPrefix}-p-${idx}` },
        renderTokens(tokenizeInline(line), `${keyPrefix}-p-${idx}`),
      ),
    );
  });
  flushList();

  return createElement(Fragment, null, ...blocks);
}
