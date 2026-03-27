import connectDB from "@/lib/db";
import { getRedis } from "@/lib/redis";
import Translation from "@/models/translation";
import Language from "@/models/language";

export type Locale = string;

const CACHE_TTL_SECONDS = 5 * 60;

async function redisGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string): Promise<void> {
  try {
    await getRedis().set(key, value, "EX", CACHE_TTL_SECONDS);
  } catch {
    // Redis unavailable — skip caching
  }
}

export async function getActiveLocales(): Promise<string[]> {
  const cacheKey = "i18n:active-locales";
  const cached = await redisGet(cacheKey);
  if (cached) return JSON.parse(cached) as string[];

  try {
    await connectDB();
    const languages = await Language.find({ isActive: true }).lean();
    const codes = languages.map((l) => l.code);
    if (codes.length === 0) return ["de"];
    await redisSet(cacheKey, JSON.stringify(codes));
    return codes;
  } catch {
    return ["de"];
  }
}

export async function getDefaultLocale(): Promise<string> {
  const cacheKey = "i18n:default-locale";
  const cached = await redisGet(cacheKey);
  if (cached) return cached;

  try {
    await connectDB();
    const defaultLang = await Language.findOne({ isDefault: true }).lean();
    const code = defaultLang?.code ?? "de";
    await redisSet(cacheKey, code);
    return code;
  } catch {
    return "de";
  }
}

export async function getActiveLanguages(): Promise<
  { code: string; name: string }[]
> {
  const cacheKey = "i18n:active-languages";
  const cached = await redisGet(cacheKey);
  if (cached) return JSON.parse(cached) as { code: string; name: string }[];

  try {
    await connectDB();
    const languages = await Language.find({ isActive: true })
      .select("code name")
      .lean();
    const result = languages.map((l) => ({ code: l.code, name: l.name }));
    if (result.length === 0) return [{ code: "de", name: "Deutsch" }];
    await redisSet(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return [{ code: "de", name: "Deutsch" }];
  }
}

export async function getDictionary(
  lang: string,
  namespace: string
): Promise<Record<string, string>> {
  const cacheKey = `i18n:${lang}:${namespace}`;
  const cached = await redisGet(cacheKey);
  if (cached) return JSON.parse(cached) as Record<string, string>;

  try {
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
    await redisSet(cacheKey, JSON.stringify(dictionary));
    return dictionary;
  } catch {
    return {};
  }
}

export async function invalidateTranslationCache(
  namespace: string
): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`i18n:*:${namespace}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis unavailable
  }
}

export async function invalidateLanguageCache(): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(
      "i18n:active-locales",
      "i18n:default-locale",
      "i18n:active-languages"
    );
  } catch {
    // Redis unavailable
  }
}
