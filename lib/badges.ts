import { Types } from "mongoose";
import Badge, { type IBadge } from "@/models/badge";
import UserBadge from "@/models/user-badge";
import type {
  AdminUserBadgeSummaryResponse,
  BadgeDefinitionSummary,
  BadgeSummary,
} from "@/types/badges";

type LegacyStoredBadge = {
  key: string;
  label: string;
  active?: boolean;
  tone?: "neutral" | "green" | "gold" | "lilac" | "blue";
  awardedAt?: Date | null;
  expiresAt?: Date | null;
  sortOrder?: number;
};

type LegacyBadgeLike =
  | {
      badges?: LegacyStoredBadge[];
    }
  | null
  | undefined;

type AdminBadgeUserLike = {
  _id: unknown;
  name: string;
  username?: string | null;
  email?: string | null;
  badges?: LegacyStoredBadge[];
};

const CORE_BADGES: Array<{
  key: string;
  slug: string;
  label: string;
  iconUrl: string;
  description: string;
  tone: "neutral" | "green" | "gold" | "lilac" | "blue";
  active: boolean;
  sortOrder: number;
  visibility: "public" | "staff_only";
  category: string;
}> = [
  {
    key: "beta_tester",
    slug: "beta-tester",
    label: "Beta-Tester",
    iconUrl: "/badges/beta-badge.webp",
    description: "Hat PACKATTACK während der Beta-Phase unterstützt und neue Funktionen mitgetestet.",
    tone: "green",
    active: true,
    sortOrder: 100,
    visibility: "public",
    category: "testing",
  },
  {
    key: "quiz_1st",
    slug: "quiz-1st",
    label: "Quiz-Champion",
    iconUrl: "/badges/quiz-badge-01-gold.svg",
    description: "1. Platz bei einem Quiz-Event.",
    tone: "gold",
    active: true,
    sortOrder: 200,
    visibility: "public",
    category: "quiz",
  },
  {
    key: "quiz_2nd",
    slug: "quiz-2nd",
    label: "Quiz-Silber",
    iconUrl: "/badges/quiz-badge-01-silver.svg",
    description: "2. Platz bei einem Quiz-Event.",
    tone: "neutral",
    active: true,
    sortOrder: 190,
    visibility: "public",
    category: "quiz",
  },
  {
    key: "quiz_3rd",
    slug: "quiz-3rd",
    label: "Quiz-Bronze",
    iconUrl: "/badges/quiz-badge-01-bronze.svg",
    description: "3. Platz bei einem Quiz-Event.",
    tone: "neutral",
    active: true,
    sortOrder: 180,
    visibility: "public",
    category: "quiz",
  },
  {
    key: "quiz_participant",
    slug: "quiz-participant",
    label: "Quiz-Teilnehmer",
    iconUrl: "/badges/quiz-badge-01-white.svg",
    description: "Hat an einem Quiz-Event teilgenommen.",
    tone: "neutral",
    active: true,
    sortOrder: 170,
    visibility: "public",
    category: "quiz",
  },
];

function toStringId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    return value.toString();
  }
  return "";
}

function serializeBadgeDefinition(badge: IBadge): BadgeDefinitionSummary {
  return {
    id: badge._id.toString(),
    key: badge.key,
    slug: badge.slug,
    label: badge.label,
    iconUrl: badge.iconUrl ?? null,
    description: badge.description ?? null,
    tone: badge.tone,
    active: badge.active,
    sortOrder: badge.sortOrder,
    visibility: badge.visibility,
    category: badge.category ?? null,
  };
}

function sortBadgeSummaries(left: BadgeSummary, right: BadgeSummary) {
  const leftAwardedAt = left.awardedAt ? new Date(left.awardedAt).getTime() : 0;
  const rightAwardedAt = right.awardedAt ? new Date(right.awardedAt).getTime() : 0;
  return rightAwardedAt - leftAwardedAt || left.label.localeCompare(right.label, "de");
}

export async function getBadgeDefinitionsMapByKeys(keys: string[]) {
  await ensureCoreBadgesSeeded();
  const normalizedKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (normalizedKeys.length === 0) {
    return new Map<string, BadgeDefinitionSummary>();
  }

  const definitions = await Badge.find({ key: { $in: normalizedKeys } }).lean();
  return new Map(
    definitions.map((badge) => {
      const serialized = serializeBadgeDefinition(badge as IBadge);
      return [serialized.key, serialized] as const;
    })
  );
}

export function applyBadgeDefinitionOverrides(
  badges: BadgeSummary[],
  definitionsByKey: Map<string, BadgeDefinitionSummary>
) {
  return badges
    .map((badge) => {
      const definition = definitionsByKey.get(badge.key);
      if (!definition) {
        return badge;
      }

      return {
        ...badge,
        slug: definition.slug,
        label: definition.label,
        iconUrl: definition.iconUrl,
        description: definition.description,
        tone: definition.tone,
        category: definition.category,
      } satisfies BadgeSummary;
    })
    .sort(sortBadgeSummaries);
}

export async function ensureCoreBadgesSeeded() {
  await Promise.all(
    CORE_BADGES.map((badge) =>
      Badge.findOneAndUpdate(
        { key: badge.key },
        {
          $setOnInsert: {
            key: badge.key,
            slug: badge.slug,
          },
          $set: {
            label: badge.label,
            iconUrl: badge.iconUrl,
            description: badge.description,
            tone: badge.tone,
            active: badge.active,
            sortOrder: badge.sortOrder,
            visibility: badge.visibility,
            category: badge.category,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      )
    )
  );
}

export function getLegacyBadgeSummaries(user: LegacyBadgeLike): BadgeSummary[] {
  return (user?.badges ?? [])
    .filter((badge) => badge.active !== false)
    .filter((badge) => !badge.expiresAt || badge.expiresAt.getTime() > Date.now())
    .sort((left, right) => (right.sortOrder ?? 0) - (left.sortOrder ?? 0))
    .map((badge) => ({
      key: badge.key,
      slug: null,
      label: badge.label,
      iconUrl: null,
      description: null,
      tone: badge.tone ?? "neutral",
      awardedAt: badge.awardedAt ? badge.awardedAt.toISOString() : null,
      awardReason: null,
      category: null,
    }));
}

export async function getActiveBadgeDefinitions(): Promise<BadgeDefinitionSummary[]> {
  await ensureCoreBadgesSeeded();
  const badges = await Badge.find({ active: true }).sort({ sortOrder: -1, label: 1 }).lean();
  return badges.map((badge) => serializeBadgeDefinition(badge as IBadge));
}

export async function getUserBadgeSummariesForUsers(
  userIds: Array<string | Types.ObjectId>
): Promise<Map<string, BadgeSummary[]>> {
  await ensureCoreBadgesSeeded();

  const normalizedUserIds = [...new Set(userIds.map((userId) => toStringId(userId)).filter(Boolean))];
  if (normalizedUserIds.length === 0) {
    return new Map();
  }

  const awards = await UserBadge.find({
    userId: { $in: normalizedUserIds.map((userId) => new Types.ObjectId(userId)) },
    active: true,
  })
    .sort({ awardedAt: -1 })
    .lean();

  const badgeIds = [...new Set(awards.map((award) => toStringId(award.badgeId)).filter(Boolean))];
  const definitions =
    badgeIds.length > 0
      ? await Badge.find({ _id: { $in: badgeIds } }).lean()
      : [];
  const definitionsById = new Map(definitions.map((badge) => [toStringId(badge._id), badge as IBadge]));
  const summariesByUser = new Map<string, BadgeSummary[]>();

  for (const award of awards) {
    const definition = definitionsById.get(toStringId(award.badgeId));
    if (!definition) continue;

    const userId = toStringId(award.userId);
    const current = summariesByUser.get(userId) ?? [];
    current.push({
      key: definition.key,
      slug: definition.slug,
      label: definition.label,
      iconUrl: definition.iconUrl ?? null,
      description: definition.description ?? null,
      tone: definition.tone,
      awardedAt: award.awardedAt ? new Date(award.awardedAt).toISOString() : null,
      awardReason: award.awardReason ?? null,
      category: definition.category ?? null,
    });
    summariesByUser.set(userId, current);
  }

  for (const [userId, badges] of summariesByUser) {
    summariesByUser.set(userId, badges.sort(sortBadgeSummaries));
  }

  return summariesByUser;
}

export async function bulkGrantBadges(input: {
  grants: Array<{
    userId: string;
    badgeKey: string;
    awardReason?: string | null;
    note?: string | null;
  }>;
  awardedByUserId: string | null;
}): Promise<{
  granted: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; badgeKey: string; error: string }>;
}> {
  await ensureCoreBadgesSeeded();

  const uniqueKeys = [...new Set(input.grants.map((g) => g.badgeKey))];
  const badges = await Badge.find({ key: { $in: uniqueKeys }, active: true }).lean();
  const badgeByKey = new Map(badges.map((b) => [b.key, b as IBadge]));

  let granted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ userId: string; badgeKey: string; error: string }> = [];

  // Process in chunks of 10
  for (let i = 0; i < input.grants.length; i += 10) {
    const chunk = input.grants.slice(i, i + 10);
    const results = await Promise.allSettled(
      chunk.map(async (grant) => {
        const badge = badgeByKey.get(grant.badgeKey);
        if (!badge) {
          throw new Error(`Badge "${grant.badgeKey}" not found`);
        }

        const existing = await UserBadge.findOne({
          userId: grant.userId,
          badgeId: badge._id,
          active: true,
        }).lean();

        if (existing) return "skipped" as const;

        await UserBadge.create({
          userId: grant.userId,
          badgeId: badge._id,
          badgeKeySnapshot: badge.key,
          awardedAt: new Date(),
          awardedByUserId: input.awardedByUserId ?? null,
          awardReason: grant.awardReason?.trim() || null,
          note: grant.note?.trim() || null,
          active: true,
        });

        return "granted" as const;
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        if (result.value === "granted") granted++;
        else skipped++;
      } else {
        failed++;
        errors.push({
          userId: chunk[j].userId,
          badgeKey: chunk[j].badgeKey,
          error: result.reason instanceof Error ? result.reason.message : "Unknown error",
        });
      }
    }
  }

  return { granted, skipped, failed, errors };
}

export async function grantBadgeToUser(input: {
  userId: string;
  badgeKey: string;
  awardedByUserId?: string | null;
  awardReason?: string | null;
  note?: string | null;
}) {
  await ensureCoreBadgesSeeded();
  const badge = await Badge.findOne({ key: input.badgeKey, active: true });
  if (!badge) {
    return null;
  }

  const existing = await UserBadge.findOne({
    userId: input.userId,
    badgeId: badge._id,
    active: true,
  }).lean();

  if (!existing) {
    await UserBadge.create({
      userId: input.userId,
      badgeId: badge._id,
      badgeKeySnapshot: badge.key,
      awardedAt: new Date(),
      awardedByUserId: input.awardedByUserId ?? null,
      awardReason: input.awardReason?.trim() || null,
      note: input.note?.trim() || null,
      active: true,
    });
  }

  return badge;
}

export async function revokeBadgeFromUser(input: {
  userId: string;
  badgeKey: string;
  revokedByUserId?: string | null;
  revokeReason?: string | null;
}) {
  await ensureCoreBadgesSeeded();
  const badge = await Badge.findOne({ key: input.badgeKey }).lean();
  if (!badge) {
    return null;
  }

  await UserBadge.findOneAndUpdate(
    {
      userId: input.userId,
      badgeId: badge._id,
      active: true,
    },
    {
      $set: {
        active: false,
        revokedAt: new Date(),
        revokedByUserId: input.revokedByUserId ?? null,
        revokeReason: input.revokeReason?.trim() || null,
      },
    }
  );

  return badge;
}

export async function buildAdminUserBadgesResponse(input: {
  user: AdminBadgeUserLike;
}): Promise<AdminUserBadgeSummaryResponse> {
  const definitions = await getActiveBadgeDefinitions();
  const userId = toStringId(input.user._id);
  const badgesMap = await getUserBadgeSummariesForUsers(userId ? [userId] : []);
  const badges = badgesMap.get(userId) ?? getLegacyBadgeSummaries(input.user);

  return {
    user: {
      id: userId,
      name: input.user.name,
      username: input.user.username ?? null,
      email: input.user.email ?? null,
    },
    badges,
    availableBadges: definitions,
  };
}
