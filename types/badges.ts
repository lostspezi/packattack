export type BadgeTone = "neutral" | "green" | "gold" | "lilac" | "blue";

export interface BadgeSummary {
  key: string;
  slug: string | null;
  label: string;
  iconUrl: string | null;
  description: string | null;
  tone: BadgeTone;
  awardedAt: string | null;
  awardReason: string | null;
  category: string | null;
}

export interface BadgeDefinitionSummary {
  id: string;
  key: string;
  slug: string;
  label: string;
  iconUrl: string | null;
  description: string | null;
  tone: BadgeTone;
  active: boolean;
  sortOrder: number;
  visibility: "public" | "staff_only";
  category: string | null;
}

export interface AdminUserBadgeSummaryResponse {
  user: {
    id: string;
    name: string;
    username: string | null;
    email: string | null;
  };
  badges: BadgeSummary[];
  availableBadges: BadgeDefinitionSummary[];
}

export interface AdminBadgeMutationResponse {
  badges: BadgeSummary[];
}
