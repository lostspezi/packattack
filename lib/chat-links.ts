const LINK_REGEX =
  /(?<!@)\b((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

export function extractChatLinks(input: string): string[] {
  const matches = input.match(LINK_REGEX) ?? [];

  return [...new Set(matches.map((item) => item.trim().replace(/[),.!?]+$/, "")))];
}

export function containsChatLink(input: string): boolean {
  return extractChatLinks(input).length > 0;
}

export function normalizeChatBody(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}
