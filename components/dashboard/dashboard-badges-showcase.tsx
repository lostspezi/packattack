import { cache } from "react";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardBadgesShowcaseProps {
  userId: string;
}

interface BadgeRow {
  key: string;
  label: string;
  tone: string;
  awardedAt: string;
}

function badgeVariantForTone(tone: string) {
  switch (tone) {
    case "green":
      return "success";
    case "gold":
      return "warning";
    case "lilac":
    case "blue":
      return "info";
    default:
      return "user";
  }
}

const loadBadges = cache(async (userId: string): Promise<BadgeRow[]> => {
  try {
    await connectDB();
    const user = await User.findById(new Types.ObjectId(userId))
      .select("badges")
      .lean();
    if (!user?.badges) return [];
    return (user.badges as Array<{
      key: string;
      label: string;
      tone: string;
      awardedAt: Date;
      active: boolean;
      sortOrder?: number;
    }>)
      .filter((b) => b.active)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      .map((b) => ({
        key: b.key,
        label: b.label,
        tone: b.tone,
        awardedAt: b.awardedAt.toISOString(),
      }));
  } catch (err) {
    console.error("[dashboard-badges-showcase] loadBadges failed:", err);
    return [];
  }
});

export async function DashboardBadgesShowcase({ userId }: DashboardBadgesShowcaseProps) {
  const badges = await loadBadges(userId);
  if (badges.length === 0) return null;

  return (
    <Card variant="soft" className="p-5">
      <h3 className="text-text-primary font-semibold mb-3">Achievements</h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.key} variant={badgeVariantForTone(badge.tone)}>
            {badge.label}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
