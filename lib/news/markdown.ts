import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

// Markdown subset for news posts: paragraphs, h2/h3/h4 from #/##/###,
// **bold**, *italic*, `code`, [text](url), - / * list items.
//
// Links accept either an internal absolute path (starting with "/") or a
// well-formed http(s) URL. Anything else falls back to plain text. External
// links open in a new tab with rel="noopener noreferrer" so the page can't
// reach window.opener.

const LINK_PATTERN = /\[([^\]\n]+?)\]\(([^)\s]+)\)/g;
const BOLD_PATTERN = /\*\*([^*\n]+?)\*\*/g;
const ITALIC_PATTERN = /(^|[^*])\*([^*\n]+?)\*(?!\*)/g;
const CODE_PATTERN = /`([^`\n]+?)`/g;

export interface SafeLink {
  href: string;
  external: boolean;
}

export function classifyLink(rawHref: string): SafeLink | null {
  // Internal absolute paths only. Reject protocol-relative `//foo`
  // (would resolve as cross-origin) and anything containing a scheme.
  if (
    rawHref.startsWith("/") &&
    !rawHref.startsWith("//") &&
    !rawHref.includes("://") &&
    !rawHref.includes(":")
  ) {
    return { href: rawHref, external: false };
  }
  if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
    try {
      const url = new URL(rawHref);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return { href: url.toString(), external: true };
    } catch {
      return null;
    }
  }
  return null;
}

interface Token {
  type: "text" | "bold" | "italic" | "link" | "code";
  content: string;
  href?: string;
  external?: boolean;
}

function tokenizeInline(line: string): Token[] {
  const matches: Array<{ start: number; end: number; token: Token }> = [];

  for (const match of line.matchAll(LINK_PATTERN)) {
    const safe = classifyLink(match[2]);
    if (!safe) continue;
    matches.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      token: { type: "link", content: match[1], href: safe.href, external: safe.external },
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
  for (const match of line.matchAll(CODE_PATTERN)) {
    matches.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      token: { type: "code", content: match[1] },
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start < lastEnd) continue;
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
      case "code":
        return createElement(
          "code",
          {
            key,
            className: "px-1 py-0.5 rounded bg-white/8 text-pa-green text-sm",
          },
          token.content
        );
      case "link":
        return createElement(
          "a",
          {
            key,
            href: token.href,
            className: "text-pa-green underline underline-offset-2 hover:text-pa-green-hover",
            ...(token.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {}),
          },
          token.content
        );
      case "text":
      default:
        return createElement(Fragment, { key }, token.content);
    }
  });
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;

export function renderNewsMarkdown(source: string, keyPrefix = "news"): ReactNode {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, idx) =>
      createElement(
        "li",
        { key: `${keyPrefix}-li-${blocks.length}-${idx}` },
        renderTokens(tokenizeInline(item), `${keyPrefix}-li-${blocks.length}-${idx}`)
      )
    );
    blocks.push(
      createElement(
        "ul",
        {
          key: `${keyPrefix}-ul-${blocks.length}`,
          className: "list-disc pl-5 space-y-1 text-text-secondary",
        },
        items
      )
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const heading = trimmed.match(HEADING_PATTERN);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      const className =
        level === 1
          ? "text-2xl font-bold text-text-primary mt-6 mb-2"
          : level === 2
            ? "text-xl font-semibold text-text-primary mt-5 mb-2"
            : "text-lg font-semibold text-text-primary mt-4 mb-1";
      blocks.push(
        createElement(
          tag,
          { key: `${keyPrefix}-h-${idx}`, className },
          renderTokens(tokenizeInline(heading[2]), `${keyPrefix}-h-${idx}`)
        )
      );
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
        {
          key: `${keyPrefix}-p-${idx}`,
          className: "text-text-secondary leading-relaxed",
        },
        renderTokens(tokenizeInline(line), `${keyPrefix}-p-${idx}`)
      )
    );
  });
  flushList();

  return createElement(Fragment, null, ...blocks);
}
