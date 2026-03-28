import { getChatCopy, type ChatUiCopy } from "@/lib/chat-copy";

export type ChatDictionary = Record<string, string>;

function readValue(dict: ChatDictionary, key: string, fallback: string): string {
  const value = dict[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function mergeSection<T extends { [K in keyof T]: string }>(
  section: T,
  prefix: string,
  dict: ChatDictionary
): T {
  const source = section as Record<string, string>;

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      readValue(dict, `${prefix}_${key}`, value),
    ])
  ) as T;
}

export function getChatUiCopy(lang: string, dict: ChatDictionary = {}): ChatUiCopy {
  const base = getChatCopy(lang);

  return {
    page: mergeSection(base.page, "page", dict),
    composer: mergeSection(base.composer, "composer", dict),
    sounds: mergeSection(base.sounds, "sounds", dict),
    reports: mergeSection(base.reports, "reports", dict),
    states: mergeSection(base.states, "states", dict),
    admin: mergeSection(base.admin, "admin", dict),
    roomModes: mergeSection(base.roomModes, "roomModes", dict),
    badges: mergeSection(base.badges, "badges", dict),
  };
}
