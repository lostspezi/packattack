import type { Model, Types } from "mongoose";
import type {
  AchievementCategory,
  AchievementReward,
  AchievementTrigger,
  IAchievement,
} from "@/models/achievement";
import type { ITranslation } from "@/models/translation";

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const MAX_ICON_SIZE = 2 * 1024 * 1024;

const VALID_CATEGORIES: AchievementCategory[] = [
  "level",
  "progression",
  "battle",
  "economy",
  "social",
  "event",
];

const VALID_TRIGGER_TYPES = ["level", "counter", "once", "manual"] as const;
const VALID_COUNTER_METRICS = [
  "boxesOpened",
  "cardsConverted",
  "battlesPlayed",
  "battlesWon",
  "coinsSpent",
  "loginDays",
] as const;
const VALID_ONCE_EVENTS = [
  "tour_completed",
  "first_pack_opened",
  "first_battle",
  "first_purchase",
] as const;
const VALID_REWARD_TYPES = [
  "coins",
  "convert_multiplier",
  "unlock_box",
  "cosmetic",
  "grant_badge",
] as const;
const VALID_COSMETIC_SLOTS = ["title", "frame", "chat_color"] as const;

export interface RawAchievementPayload {
  key?: string;
  category?: string;
  hidden?: boolean;
  active?: boolean;
  sortOrder?: number;
  trigger?: unknown;
  rewards?: unknown;
  titles?: Record<string, string>;
  descriptions?: Record<string, string>;
}

export interface SanitizedAchievementPayload {
  ok: true;
  data: {
    key: string;
    category: AchievementCategory;
    hidden: boolean;
    active: boolean;
    sortOrder: number;
    trigger: AchievementTrigger;
    rewards: AchievementReward[];
    titles: Record<string, string>;
    descriptions: Record<string, string>;
  };
}

export interface AchievementPayloadError {
  ok: false;
  error: string;
}

export function parseAchievementPayload(form: FormData): RawAchievementPayload {
  const read = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : undefined;
  };

  let trigger: unknown = null;
  try {
    const raw = read("trigger");
    trigger = raw ? JSON.parse(raw) : null;
  } catch {
    trigger = "__invalid__";
  }

  let rewards: unknown = [];
  try {
    const raw = read("rewards");
    rewards = raw ? JSON.parse(raw) : [];
  } catch {
    rewards = "__invalid__";
  }

  let titles: Record<string, string> = {};
  let descriptions: Record<string, string> = {};
  try {
    const rawT = read("titles");
    if (rawT) {
      const parsed = JSON.parse(rawT);
      if (parsed && typeof parsed === "object") titles = parsed as Record<string, string>;
    }
    const rawD = read("descriptions");
    if (rawD) {
      const parsed = JSON.parse(rawD);
      if (parsed && typeof parsed === "object") descriptions = parsed as Record<string, string>;
    }
  } catch {
    // ignore — sanitize step will report invalid_copy
  }

  return {
    key: read("key")?.trim(),
    category: read("category")?.trim(),
    hidden: read("hidden") === "true",
    active: read("active") !== "false", // default true
    sortOrder: (() => {
      const n = Number(read("sortOrder") ?? "0");
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    })(),
    trigger,
    rewards,
    titles,
    descriptions,
  };
}

function validateTrigger(raw: unknown): AchievementTrigger | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as { type?: string; params?: unknown };
  if (!VALID_TRIGGER_TYPES.includes(t.type as (typeof VALID_TRIGGER_TYPES)[number])) {
    return null;
  }
  const params = (t.params ?? {}) as Record<string, unknown>;

  switch (t.type) {
    case "level": {
      const level = Number(params.level);
      if (!Number.isFinite(level) || level < 1 || level > 100) return null;
      return { type: "level", params: { level: Math.trunc(level) } };
    }
    case "counter": {
      const metric = String(params.metric ?? "");
      if (!VALID_COUNTER_METRICS.includes(metric as (typeof VALID_COUNTER_METRICS)[number])) {
        return null;
      }
      const target = Number(params.target);
      if (!Number.isFinite(target) || target < 1) return null;
      return {
        type: "counter",
        params: {
          metric: metric as (typeof VALID_COUNTER_METRICS)[number],
          target: Math.trunc(target),
        },
      };
    }
    case "once": {
      const event = String(params.event ?? "");
      if (!VALID_ONCE_EVENTS.includes(event as (typeof VALID_ONCE_EVENTS)[number])) {
        return null;
      }
      return {
        type: "once",
        params: { event: event as (typeof VALID_ONCE_EVENTS)[number] },
      };
    }
    case "manual":
      return { type: "manual", params: {} };
    default:
      return null;
  }
}

function validateRewards(raw: unknown): AchievementReward[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AchievementReward[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const r = entry as { type?: string; params?: unknown };
    if (!VALID_REWARD_TYPES.includes(r.type as (typeof VALID_REWARD_TYPES)[number])) {
      return null;
    }
    const params = (r.params ?? {}) as Record<string, unknown>;
    switch (r.type) {
      case "coins": {
        const amount = Number(params.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        out.push({ type: "coins", params: { amount: Math.trunc(amount) } });
        break;
      }
      case "convert_multiplier": {
        const mult = Number(params.multiplier);
        if (!Number.isFinite(mult) || mult <= 0 || mult > 10) return null;
        out.push({ type: "convert_multiplier", params: { multiplier: mult } });
        break;
      }
      case "unlock_box": {
        const slug = String(params.boxSlug ?? "").trim();
        if (!slug) return null;
        out.push({ type: "unlock_box", params: { boxSlug: slug } });
        break;
      }
      case "cosmetic": {
        const slot = String(params.slot ?? "");
        const value = String(params.value ?? "").trim();
        if (
          !VALID_COSMETIC_SLOTS.includes(slot as (typeof VALID_COSMETIC_SLOTS)[number]) ||
          !value
        ) {
          return null;
        }
        out.push({ type: "cosmetic", params: { slot, value } });
        break;
      }
      case "grant_badge": {
        const badgeKey = String(params.badgeKey ?? "").trim();
        if (!badgeKey) return null;
        out.push({ type: "grant_badge", params: { badgeKey } });
        break;
      }
    }
  }
  return out;
}

function sanitizeCopyMap(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [lang, text] of Object.entries(input)) {
    const langKey = lang.toLowerCase().trim();
    if (!/^[a-z]{2}$/.test(langKey)) continue;
    const value = String(text ?? "").trim();
    if (!value || value.length > 500) continue;
    out[langKey] = value;
  }
  return out;
}

export function sanitizeAchievementPayload(
  raw: RawAchievementPayload,
  opts: { requireKey?: boolean } = { requireKey: true },
): SanitizedAchievementPayload | AchievementPayloadError {
  const key = (raw.key ?? "").trim();
  if (opts.requireKey) {
    if (!key) return { ok: false, error: "key_required" };
    if (!/^[a-z0-9_]{2,64}$/.test(key)) return { ok: false, error: "key_invalid" };
  }

  const category = (raw.category ?? "progression") as AchievementCategory;
  if (!VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "category_invalid" };
  }

  const trigger = validateTrigger(raw.trigger);
  if (!trigger) return { ok: false, error: "trigger_invalid" };

  const rewards = validateRewards(raw.rewards);
  if (!rewards) return { ok: false, error: "rewards_invalid" };

  const titles = sanitizeCopyMap(raw.titles);
  const descriptions = sanitizeCopyMap(raw.descriptions);

  if (!titles.de && !titles.en) return { ok: false, error: "title_required" };

  return {
    ok: true,
    data: {
      key,
      category,
      hidden: Boolean(raw.hidden),
      active: raw.active !== false,
      sortOrder: Number.isFinite(raw.sortOrder) ? (raw.sortOrder as number) : 0,
      trigger,
      rewards,
      titles,
      descriptions,
    },
  };
}

async function mergeTranslationValues(
  TranslationModel: Model<ITranslation>,
  namespace: string,
  key: string,
  incoming: Record<string, string>,
  updatedByUserId: string | null,
): Promise<void> {
  // Merge statt replace: alte Sprachen bleiben erhalten, wenn der Admin
  // in dieser Submission nur eine Sprache editiert. Keys mit explizitem
  // Leer-String werden als "löschen" interpretiert.
  const existing = await TranslationModel.findOne({ namespace, key })
    .lean<{ values?: Record<string, string> | Map<string, string> } | null>();
  const prev: Record<string, string> = existing?.values
    ? existing.values instanceof Map
      ? Object.fromEntries(existing.values)
      : { ...existing.values }
    : {};
  for (const [lang, value] of Object.entries(incoming)) {
    prev[lang] = value;
  }

  await TranslationModel.updateOne(
    { namespace, key },
    {
      $set: {
        values: new Map(Object.entries(prev)),
        updatedBy: updatedByUserId,
      },
    },
    { upsert: true },
  );
}

export async function upsertAchievementTranslations(
  TranslationModel: Model<ITranslation>,
  key: string,
  titles: Record<string, string>,
  descriptions: Record<string, string>,
  updatedByUserId: string | null,
): Promise<void> {
  await mergeTranslationValues(
    TranslationModel,
    "achievements",
    `${key}.title`,
    titles,
    updatedByUserId,
  );
  await mergeTranslationValues(
    TranslationModel,
    "achievements",
    `${key}.description`,
    descriptions,
    updatedByUserId,
  );
}

export function serializeAchievement(a: Partial<IAchievement> & { _id: Types.ObjectId | string }) {
  return {
    _id: String(a._id),
    key: a.key,
    titleKey: a.titleKey,
    descriptionKey: a.descriptionKey,
    iconImageId: a.iconImageId ? String(a.iconImageId) : null,
    category: a.category,
    hidden: Boolean(a.hidden),
    active: a.active !== false,
    sortOrder: a.sortOrder ?? 0,
    trigger: a.trigger,
    rewards: a.rewards ?? [],
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
