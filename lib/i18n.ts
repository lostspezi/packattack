import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import Translation from "@/models/translation";
import Language from "@/models/language";

export type Locale = string;

const CACHE_TTL_SECONDS = 5 * 60;

export async function getActiveLocales(): Promise<string[]> {
  const redis = getRedis();
  const cacheKey = "i18n:active-locales";

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as string[];

  await connectDB();
  const languages = await Language.find({ isActive: true }).lean();
  const codes = languages.map((l) => l.code);

  // Fallback if no languages exist yet (first boot before seed)
  if (codes.length === 0) return ["de"];

  await redis.set(cacheKey, JSON.stringify(codes), "EX", CACHE_TTL_SECONDS);
  return codes;
}

export async function getDefaultLocale(): Promise<string> {
  const redis = getRedis();
  const cacheKey = "i18n:default-locale";

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  await connectDB();
  const defaultLang = await Language.findOne({ isDefault: true }).lean();
  const code = defaultLang?.code ?? "de";

  await redis.set(cacheKey, code, "EX", CACHE_TTL_SECONDS);
  return code;
}

export async function getActiveLanguages(): Promise<
  { code: string; name: string }[]
> {
  const redis = getRedis();
  const cacheKey = "i18n:active-languages";

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as { code: string; name: string }[];

  await connectDB();
  const languages = await Language.find({ isActive: true })
    .select("code name")
    .lean();

  const result = languages.map((l) => ({ code: l.code, name: l.name }));

  if (result.length === 0) return [{ code: "de", name: "Deutsch" }];

  await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
  return result;
}

export async function getDictionary(
  lang: string,
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
    const values = doc.values as unknown as Record<string, string>;
    const value = values[lang];
    if (value !== undefined && value !== "") {
      dictionary[doc.key] = value;
    }
  }

  await redis.set(cacheKey, JSON.stringify(dictionary), "EX", CACHE_TTL_SECONDS);

  return dictionary;
}

export async function invalidateTranslationCache(
  namespace: string
): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(`i18n:*:${namespace}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function invalidateLanguageCache(): Promise<void> {
  const redis = getRedis();
  await redis.del(
    "i18n:active-locales",
    "i18n:default-locale",
    "i18n:active-languages"
  );
}
