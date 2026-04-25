import { Types } from "mongoose";
import connectDB from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseExpiredBulk } from "@/lib/votes/auto-close";
import { UpvoteTopBannerBar } from "@/components/votes/upvote-top-banner-bar";

interface Props {
  lang: string;
  userId: string;
}

export async function UpvoteTopBanner({ lang, userId }: Props) {
  if (!Types.ObjectId.isValid(userId)) return null;

  await connectDB();
  await autoCloseExpiredBulk();

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
    <UpvoteTopBannerBar
      lang={lang}
      campaignId={open._id.toString()}
      title={title}
      question={question}
      dictHeadline={dict["bannerHeadline"] ?? "Your vote counts"}
      dictCta={dict["bannerCta"] ?? "Vote now"}
      dictDismiss={dict["topBannerDismiss"] ?? "Dismiss"}
    />
  );
}
