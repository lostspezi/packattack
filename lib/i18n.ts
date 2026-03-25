import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import Translation from "@/models/translation";

export const locales = ["de", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

const CACHE_TTL_SECONDS = 5 * 60;

export async function getDictionary(
  lang: Locale,
  namespace: string
): Promise<Record<string, string>> {
  const cacheKey = `i18n:${lang}:${namespace}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as Record<string, string>;
  }

  await connectDB();

  const docs = await Translation.find({ namespace }).lean();

  const dictionary: Record<string, string> = {};
  for (const doc of docs) {
    dictionary[doc.key] = doc.values[lang];
  }

  await redis.set(cacheKey, JSON.stringify(dictionary), "EX", CACHE_TTL_SECONDS);

  return dictionary;
}

export async function invalidateTranslationCache(
  namespace: string
): Promise<void> {
  const redis = getRedis();
  const keys = locales.map((lang) => `i18n:${lang}:${namespace}`);
  await redis.del(...keys);
}

export function getLocaleFromHeaders(headers: Headers): Locale {
  const acceptLanguage = headers.get("accept-language") ?? "";

  const negotiator = new Negotiator({
    headers: { "accept-language": acceptLanguage },
  });

  const languages = negotiator.languages();

  try {
    return match(languages, [...locales], defaultLocale) as Locale;
  } catch {
    return defaultLocale;
  }
}
