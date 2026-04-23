export const PACKI_MESSAGE_MAX_LENGTH = 2000;

const INJECTION_MARKERS: RegExp[] = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[\[SYSTEM\]\]/gi,
  /\[SYSTEM\]/gi,
  /^\s*system\s*:/gim,
  /<system>/gi,
  /<\/system>/gi,
];

const ALLOWED_ROUTE_BASES = new Set(["dashboard", "packs", "profile"]);
const ROUTE_PATTERN = /^\/([a-zA-Z]{2,5})\/([^/?#]+)/;

export function sanitizePackiMessage(message: string): string {
  let out = message.normalize("NFKC").trim();
  for (const marker of INJECTION_MARKERS) {
    out = out.replace(marker, "");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function isPackiRouteAllowed(pathname: string): boolean {
  const match = pathname.match(ROUTE_PATTERN);
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

const PII_OUTPUT_PATTERNS: RegExp[] = [
  /\b(email|password|token|api[_-]?key|secret)\s*[:=]\s*\S+/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

export function scrubPackiOutput(text: string): string {
  let out = text;
  for (const pattern of PII_OUTPUT_PATTERNS) {
    out = out.replace(pattern, "[entfernt]");
  }
  return out;
}
