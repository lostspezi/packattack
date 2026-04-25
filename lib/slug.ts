import type { Model } from "mongoose";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_LENGTH = 8;
const MAX_ATTEMPTS = 16;

export function randomSlug(length: number = DEFAULT_LENGTH): string {
  if (length < 1) {
    throw new Error("slug length must be >= 1");
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return out;
}

interface SlugLookup {
  findOne(filter: { slug: string }): {
    select(field: string): { lean(): Promise<unknown> };
  };
}

export async function generateUniqueSlug(
  model: Model<{ slug?: string | null }> | SlugLookup,
  length: number = DEFAULT_LENGTH,
): Promise<string> {
  const lookup = model as SlugLookup;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = randomSlug(length);
    const existing = await lookup
      .findOne({ slug: candidate })
      .select("_id")
      .lean();
    if (!existing) return candidate;
  }
  throw new Error(
    `generateUniqueSlug: no free slug after ${MAX_ATTEMPTS} attempts (length=${length})`,
  );
}
