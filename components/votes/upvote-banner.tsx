import Link from "next/link";
import { Types } from "mongoose";
import { ThumbsUp } from "lucide-react";
import connectDB from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  lang: string;
  userId: string;
}

export async function UpvoteBanner({ lang, userId }: Props) {
  if (!Types.ObjectId.isValid(userId)) return null;

  // Auto-close lazy check is already executed by UpvoteTopBanner higher up
  // in the same dashboard render tree, so the dashboard banner skips it to
  // avoid a redundant updateMany per page load.
  await connectDB();

  const active = await UpvoteCampaign.find({ status: "active" })
    .select("_id title question topN endsAt")
    .sort({ endsAt: 1, createdAt: -1 })
    .lean();

  if (active.length === 0) return null;

  const userOid = new Types.ObjectId(userId);
  const myCounts = await UpvoteVote.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { campaignId: { $in: active.map((c) => c._id) }, userId: userOid } },
    { $group: { _id: "$campaignId", count: { $sum: 1 } } },
  ]);
  const votedSet = new Set(myCounts.filter((c) => c.count > 0).map((c) => c._id.toString()));

  const open = active.find((c) => !votedSet.has(c._id.toString()));
  if (!open) return null;

  const dict = await getDictionary(lang as Locale, "votes");
  const isDe = lang === "de";
  const title = isDe ? open.title.de || open.title.en : open.title.en || open.title.de;
  const question = isDe ? open.question.de || open.question.en : open.question.en || open.question.de;

  return (
    <Card variant="cut" className="p-4 md:p-5 relative overflow-hidden votes-banner-pulse">
      <div
        className="absolute inset-0 bg-gradient-to-br from-pa-green/12 via-transparent to-pa-lila/12 pointer-events-none"
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="hidden sm:flex h-12 w-12 rounded-full bg-pa-green/15 items-center justify-center shrink-0">
          <ThumbsUp className="w-6 h-6 text-pa-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-semibold text-pa-green">
            {dict["bannerHeadline"] ?? "Your vote counts"}
          </div>
          <div className="text-base md:text-lg font-bold text-text-primary mt-0.5 truncate">
            {title}
          </div>
          <div className="text-sm text-text-secondary line-clamp-1">{question}</div>
        </div>
        <Link href={`/${lang}/votes/${open._id.toString()}`} className="shrink-0">
          <Button variant="primary" size="md">
            {dict["bannerCta"] ?? "Vote now"}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
