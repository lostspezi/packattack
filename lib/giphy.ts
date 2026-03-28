import "server-only";
import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";
import type { ChatGifPickerResponse, ChatGifSummary } from "@/types/chat";

const GIPHY_API_BASE_URL = "https://api.giphy.com/v1/gifs";
const GIPHY_PAGE_SIZE = 24;
const GIPHY_RATING = "g";

type GiphyMode = "trending" | "search";

interface GiphyImageVariant {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyGifObject {
  id?: string;
  title?: string;
  slug?: string;
  rating?: string;
  images?: Record<string, GiphyImageVariant | undefined>;
}

interface GiphyApiResponse {
  data?: GiphyGifObject[];
  pagination?: {
    total_count?: number;
    count?: number;
    offset?: number;
  };
}

function getGiphyApiKey() {
  return process.env.GIPHY_API_KEY?.trim() ?? "";
}

export function isGiphyEnabled() {
  return getGiphyApiKey().length > 0;
}

function isAllowedGiphyHostname(value: string) {
  return (
    value === "giphy.com" ||
    value.endsWith(".giphy.com") ||
    value === "giphyusercontent.com" ||
    value.endsWith(".giphyusercontent.com")
  );
}

function isAllowedGiphyUrl(value: string) {
  try {
    const url = new URL(value);
    return /^https?:$/i.test(url.protocol) && isAllowedGiphyHostname(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function chooseImageVariant(images: Record<string, GiphyImageVariant | undefined> | undefined) {
  if (!images) return null;

  const preview =
    images.downsized_large ??
    images.downsized_medium ??
    images.original ??
    images.downsized ??
    images.fixed_width ??
    images.fixed_width_downsampled ??
    images.preview_gif ??
    images.fixed_width_small;
  const display =
    images.original ??
    images.downsized_large ??
    images.downsized_medium ??
    images.downsized ??
    images.fixed_width ??
    images.fixed_height;

  if (!preview || !display) {
    return null;
  }

  const previewUrl = preview.webp ?? preview.url ?? "";
  const displayUrl = display.webp ?? display.url ?? "";

  if (!previewUrl || !displayUrl) {
    return null;
  }

  const width = Number.parseInt(display.width ?? preview.width ?? "", 10);
  const height = Number.parseInt(display.height ?? preview.height ?? "", 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }

  return {
    previewUrl,
    displayUrl,
    width,
    height,
  };
}

function normalizeGifTitle(value: GiphyGifObject) {
  return (
    value.title?.trim() ||
    value.slug?.replace(/[-_]+/g, " ").trim() ||
    "GIF"
  );
}

function normalizeGif(value: GiphyGifObject): ChatGifSummary | null {
  if (!value.id) {
    return null;
  }

  const image = chooseImageVariant(value.images);
  if (!image) {
    return null;
  }

  return {
    provider: "giphy",
    id: value.id,
    title: normalizeGifTitle(value),
    rating: value.rating?.trim() || null,
    previewUrl: image.previewUrl,
    displayUrl: image.displayUrl,
    width: image.width,
    height: image.height,
  };
}

async function fetchGiphy(path: string, params: URLSearchParams): Promise<GiphyApiResponse | null> {
  const apiKey = getGiphyApiKey();
  if (!apiKey) {
    return null;
  }

  params.set("api_key", apiKey);
  params.set("rating", GIPHY_RATING);
  params.set("limit", String(GIPHY_PAGE_SIZE));

  try {
    const res = await fetch(`${GIPHY_API_BASE_URL}${path}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[giphy] Request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as GiphyApiResponse;
  } catch (error) {
    console.error("[giphy] Request error:", error);
    return null;
  }
}

async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const redis = getRedis();

  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (error) {
    console.warn("[giphy] Cache read failed:", error);
  }

  const result = await fetcher();
  if (result !== null) {
    try {
      await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
    } catch (error) {
      console.warn("[giphy] Cache write failed:", error);
    }
  }

  return result;
}

function buildPickerResponse(
  mode: GiphyMode,
  query: string,
  offset: number,
  response: GiphyApiResponse | null
): ChatGifPickerResponse {
  const gifs = (response?.data ?? [])
    .map((item) => normalizeGif(item))
    .filter((item): item is ChatGifSummary => Boolean(item));
  const total = response?.pagination?.total_count ?? null;
  const nextOffset =
    gifs.length === 0
      ? null
      : total !== null
        ? offset + gifs.length < total
          ? offset + gifs.length
          : null
        : gifs.length === GIPHY_PAGE_SIZE
          ? offset + gifs.length
          : null;

  return {
    gifs,
    mode,
    query,
    offset,
    nextOffset,
    total,
  };
}

function searchCacheKey(mode: GiphyMode, query: string, offset: number) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ mode, query, offset, rating: GIPHY_RATING }))
    .digest("hex");

  return `chat:giphy:${hash}`;
}

export async function fetchChatGifs(input: {
  mode?: GiphyMode;
  query?: string;
  offset?: number;
}): Promise<ChatGifPickerResponse | null> {
  if (!isGiphyEnabled()) {
    return null;
  }

  const query = input.query?.trim() ?? "";
  const mode: GiphyMode = query.length > 0 ? "search" : input.mode === "search" ? "search" : "trending";
  const offset = Math.max(0, input.offset ?? 0);
  const ttlSeconds = mode === "trending" ? 60 : 30;
  const cacheKey = searchCacheKey(mode, query, offset);

  return cached(cacheKey, ttlSeconds, async () => {
    const params = new URLSearchParams({
      offset: String(offset),
    });

    if (mode === "search") {
      params.set("q", query);
    }

    const response =
      mode === "search"
        ? await fetchGiphy("/search", params)
        : await fetchGiphy("/trending", params);

    return buildPickerResponse(mode, query, offset, response);
  });
}

export function sanitizeIncomingChatGif(
  value:
    | (Omit<ChatGifSummary, "rating"> & { rating?: string | null })
    | null
    | undefined
): ChatGifSummary | null {
  if (!value) {
    return null;
  }

  if (value.provider !== "giphy" || !value.id.trim()) {
    return null;
  }

  if (!isAllowedGiphyUrl(value.previewUrl) || !isAllowedGiphyUrl(value.displayUrl)) {
    return null;
  }

  const rating = value.rating?.trim().toLowerCase() ?? null;
  if (rating && rating !== GIPHY_RATING) {
    return null;
  }

  if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) {
    return null;
  }

  if (value.width < 1 || value.height < 1 || value.width > 5000 || value.height > 5000) {
    return null;
  }

  return {
    provider: "giphy",
    id: value.id.trim(),
    title: value.title.trim() || "GIF",
    rating,
    previewUrl: value.previewUrl,
    displayUrl: value.displayUrl,
    width: Math.trunc(value.width),
    height: Math.trunc(value.height),
  };
}
