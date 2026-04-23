export const PACKI_MESSAGE_MAX_LENGTH = 2000;

// Source strings (not compiled regex). We build fresh RegExp per call so a
// stateful `lastIndex` can never leak across invocations — even if a future
// change switches from .replace() (spec-safe) to .exec() / .matchAll()
// (which read lastIndex).
const INJECTION_PATTERNS: ReadonlyArray<readonly [string, string]> = [
  ["<\\|im_start\\|>", "gi"],
  ["<\\|im_end\\|>", "gi"],
  ["\\[\\[SYSTEM\\]\\]", "gi"],
  ["\\[SYSTEM\\]", "gi"],
  ["^\\s*system\\s*:", "gim"],
  ["<system>", "gi"],
  ["</system>", "gi"],
];

const ALLOWED_ROUTE_BASES = new Set(["dashboard", "packs", "profile"]);

export function sanitizePackiMessage(message: string): string {
  let out = message.normalize("NFKC").trim();
  for (const [pattern, flags] of INJECTION_PATTERNS) {
    out = out.replace(new RegExp(pattern, flags), "");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function isPackiRouteAllowed(pathname: string): boolean {
  const match = pathname.match(/^\/([a-zA-Z]{2,5})\/([^/?#]+)/);
  if (!match) return false;
  return ALLOWED_ROUTE_BASES.has(match[2]);
}

export type PackiInputRejection =
  | "empty"
  | "too_long"
  | "route_not_allowed";

export interface PackiInputValidation {
  ok: boolean;
  reason?: PackiInputRejection;
  sanitized?: string;
}

export function validatePackiInput(
  message: unknown,
  route: unknown,
): PackiInputValidation {
  if (typeof message !== "string" || typeof route !== "string") {
    return { ok: false, reason: "empty" };
  }
  const sanitized = sanitizePackiMessage(message);
  if (!sanitized) return { ok: false, reason: "empty" };
  if (sanitized.length > PACKI_MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  if (!isPackiRouteAllowed(route)) {
    return { ok: false, reason: "route_not_allowed" };
  }
  return { ok: true, sanitized };
}

const PII_OUTPUT_PATTERNS: ReadonlyArray<readonly [string, string]> = [
  ["\\b(email|password|token|api[_-]?key|secret)\\s*[:=]\\s*\\S+", "gi"],
  ["\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b", "g"],
];

export function scrubPackiOutput(text: string): string {
  let out = text;
  for (const [pattern, flags] of PII_OUTPUT_PATTERNS) {
    out = out.replace(new RegExp(pattern, flags), "[entfernt]");
  }
  return out;
}
