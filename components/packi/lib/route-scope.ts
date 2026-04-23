const ALLOWED_BASES = new Set(["dashboard", "packs", "profile"]);
const ROUTE_PATTERN = /^\/([a-zA-Z]{2,5})\/([^/?#]+)/;

export function isPackiVisible(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const match = pathname.match(ROUTE_PATTERN);
  if (!match) return false;
  return ALLOWED_BASES.has(match[2]);
}
