import BadWordsNext from "bad-words-next";
import deDictionary from "bad-words-next/lib/de";
import enDictionary from "bad-words-next/lib/en";

export type ChatModerationProvider = "none" | "local" | "sightengine";

export interface ChatModerationResult {
  provider: ChatModerationProvider;
  action: "allow" | "mask" | "hold" | "block" | "shadow_hide";
  reasonCodes: string[];
  bodyDisplay: string;
  hasPII: boolean;
}

interface ModerateChatMessageInput {
  body: string;
  lang: string;
  isAdminLinkMessage: boolean;
  trustTier: string;
}

interface LocalProfanityResult {
  bodyDisplay: string;
  reasonCodes: string[];
  normalizedOnlyMatch: boolean;
}

const profanityFilter = new BadWordsNext({ data: deDictionary });
profanityFilter.add(enDictionary);

function detectProbablePii(text: string): boolean {
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  const hasPhoneLikeNumber = /\+?\d[\d\s\-/()]{6,}\d/.test(text);
  return hasEmail || hasPhoneLikeNumber;
}

function detectCapsSpam(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-ZÄÖÜ]/g, "").length;
  return upper / letters.length > 0.8;
}

function normalizeForProfanity(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/ä/gim, "ae")
    .replace(/ö/gim, "oe")
    .replace(/ü/gim, "ue")
    .replace(/ß/gim, "ss")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t");
}

function collectMaskedMatches(input: string): { masked: string; matches: string[] } {
  const matches = new Set<string>();
  const masked = profanityFilter.filter(input, (badword) => {
    matches.add(badword.toLowerCase());
  });

  return { masked, matches: [...matches] };
}

function isMostlyProfanity(input: string, masked: string, matchCount: number): boolean {
  if (matchCount === 0) {
    return false;
  }

  const compactOriginal = input.replace(/\s+/g, "");
  const compactMasked = masked.replace(/\*/g, "").replace(/\s+/g, "");

  if (matchCount > 1) {
    return true;
  }

  return compactMasked.length <= Math.max(2, Math.floor(compactOriginal.length * 0.35));
}

function moderateWithLocalProfanity(body: string): LocalProfanityResult | null {
  const direct = collectMaskedMatches(body);
  const normalized = normalizeForProfanity(body);
  const normalizedMatches =
    normalized !== body ? collectMaskedMatches(normalized).matches : [];
  const matchedByNormalization =
    direct.matches.length === 0 && normalizedMatches.length > 0;
  const totalMatches = new Set([...direct.matches, ...normalizedMatches]);

  if (totalMatches.size === 0) {
    return null;
  }

  return {
    bodyDisplay: direct.matches.length > 0 ? direct.masked : body,
    reasonCodes: matchedByNormalization
      ? ["profanity_obfuscated"]
      : isMostlyProfanity(body, direct.masked, totalMatches.size)
        ? ["profanity_blocked"]
        : ["profanity_masked"],
    normalizedOnlyMatch: matchedByNormalization,
  };
}

function hasSignalMatch(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return value >= 0.5;
  if (!value || typeof value !== "object") return false;

  return Object.values(value as Record<string, unknown>).some((item) => hasSignalMatch(item));
}

function resolveSightengineAvailability(): boolean {
  return Boolean(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET);
}

export function resolveChatModerationProvider(): ChatModerationProvider {
  if (
    process.env.CHAT_MODERATION_PROVIDER?.toLowerCase() === "sightengine" &&
    resolveSightengineAvailability()
  ) {
    return "sightengine";
  }

  return "local";
}

async function moderateWithSightengine({
  body,
  lang,
  isAdminLinkMessage,
  trustTier,
}: ModerateChatMessageInput): Promise<ChatModerationResult> {
  const reasonCodes: string[] = [];
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    return {
      provider: "local",
      action: "block",
      reasonCodes: ["provider_unavailable"],
      bodyDisplay: body,
      hasPII: false,
    };
  }

  try {
    const payload = new URLSearchParams({
      text: body,
      lang,
      mode: "rules",
      api_user: apiUser,
      api_secret: apiSecret,
    });

    const response = await fetch("https://api.sightengine.com/1.0/text/check.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Moderation provider returned ${response.status}`);
    }

    const result = (await response.json()) as Record<string, unknown>;

    if (hasSignalMatch(result.personal)) {
      return {
        provider: "sightengine",
        action: "block",
        reasonCodes: ["pii_detected"],
        bodyDisplay: body,
        hasPII: true,
      };
    }

    if (hasSignalMatch(result.extremism) || hasSignalMatch(result.violence)) {
      return {
        provider: "sightengine",
        action: "block",
        reasonCodes: ["severe_content"],
        bodyDisplay: body,
        hasPII: false,
      };
    }

    if (hasSignalMatch(result.spam) || (hasSignalMatch(result.link) && !isAdminLinkMessage)) {
      return {
        provider: "sightengine",
        action: "block",
        reasonCodes: ["spam_or_link"],
        bodyDisplay: body,
        hasPII: false,
      };
    }

    if (
      hasSignalMatch(result.profanity) ||
      hasSignalMatch(result.insult) ||
      hasSignalMatch(result.toxic)
    ) {
      const masked = collectMaskedMatches(body).masked;

      return {
        provider: "sightengine",
        action: trustTier === "new" ? "block" : "mask",
        reasonCodes: ["toxic_language"],
        bodyDisplay: trustTier === "new" ? body : masked,
        hasPII: false,
      };
    }
  } catch {
    return {
      provider: "local",
      action: "block",
      reasonCodes: ["provider_unavailable"],
      bodyDisplay: body,
      hasPII: false,
    };
  }

  return {
    provider: "sightengine",
    action: "allow",
    reasonCodes,
    bodyDisplay: body,
    hasPII: false,
  };
}

export async function moderateChatMessage({
  body,
  lang,
  isAdminLinkMessage,
  trustTier,
}: ModerateChatMessageInput): Promise<ChatModerationResult> {
  const hasPII = detectProbablePii(body);

  if (hasPII) {
    return {
      provider: "local",
      action: "block",
      reasonCodes: ["pii_detected"],
      bodyDisplay: body,
      hasPII: true,
    };
  }

  if (detectCapsSpam(body) && trustTier !== "staff") {
    return {
      provider: "local",
      action: "block",
      reasonCodes: ["caps_spam"],
      bodyDisplay: body,
      hasPII: false,
    };
  }

  if (resolveChatModerationProvider() === "sightengine") {
    return moderateWithSightengine({ body, lang, isAdminLinkMessage, trustTier });
  }

  const profanity = moderateWithLocalProfanity(body);
  if (!profanity) {
    return {
      provider: "local",
      action: "allow",
      reasonCodes: [],
      bodyDisplay: body,
      hasPII: false,
    };
  }

  const shouldBlock =
    profanity.normalizedOnlyMatch || profanity.reasonCodes.includes("profanity_blocked");

  return {
    provider: "local",
    action: shouldBlock ? "block" : "mask",
    reasonCodes: profanity.reasonCodes,
    bodyDisplay: shouldBlock ? body : profanity.bodyDisplay,
    hasPII: false,
  };
}
