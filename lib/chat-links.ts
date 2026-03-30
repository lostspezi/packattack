const LINK_REGEX =
  /(?<!@)\b((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

const EXPLICIT_LINK_REGEX = /^(?:https?:\/\/|www\.)/i;
const SIMPLE_BARE_DOMAIN_REGEX = /^[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i;

export function isChatLinkCandidate(input: string): boolean {
  const value = input.trim().replace(/[),.!?]+$/, "");
  if (!value) return false;

  // Always allow explicit links with protocol or www.
  if (EXPLICIT_LINK_REGEX.test(value)) {
    return true;
  }

  // For implicit links, only auto-link simple host.tld(+optional path) forms.
  // This avoids false positives like card names such as Monkey.D.Luffy.
  return SIMPLE_BARE_DOMAIN_REGEX.test(value);
}

export function extractChatLinks(input: string): string[] {
  const matches = input.match(LINK_REGEX) ?? [];

  return [
    ...new Set(
      matches
        .map((item) => item.trim().replace(/[),.!?]+$/, ""))
        .filter((item) => isChatLinkCandidate(item))
    ),
  ];
}

export function containsChatLink(input: string): boolean {
  return extractChatLinks(input).length > 0;
}

export function normalizeChatBody(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
