import Link from "next/link";
import { Types } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseIfExpired } from "@/lib/votes/auto-close";
import {
  aggregateVotes,
  countUniqueVoters,
  rankAggregatedVotes,
} from "@/lib/votes/aggregate";
import { UpvoteItemGrid } from "@/components/votes/upvote-item-grid";
import { UpvoteReveal } from "@/components/votes/upvote-reveal";
import type { VotingItem } from "@/components/votes/upvote-item-tile";

export default async function VoteDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${lang}/login`);
  const userId = session.user.id;

  if (!Types.ObjectId.isValid(id)) notFound();

  const dict = await getDictionary(lang as Locale, "votes");
  const isDe = lang === "de";

  await connectDB();
  let campaign = await UpvoteCampaign.findById(id);
  if (!campaign) notFound();
  campaign = await autoCloseIfExpired(campaign);
  if (campaign.status === "draft") notFound();

  const myVotes = await UpvoteVote.find({
    campaignId: campaign._id,
    userId: new Types.ObjectId(userId),
  })
    .select("itemRefId")
    .lean();
  const myPicks = myVotes.map((v) => v.itemRefId.toString());

  const items: VotingItem[] = campaign.items
    .map((c) => ({
      _id: c._id.toString(),
      kind: c.kind,
      label: { de: c.label.de, en: c.label.en },
      description: { de: c.description.de, en: c.description.en },
      image: c.image,
      rarity: c.rarity,
      setName: c.setName,
      game: c.game,
      boxSlug: c.boxSlug,
      position: c.position,
    }))
    .sort((a, b) => a.position - b.position);

  const title = isDe ? campaign.title.de || campaign.title.en : campaign.title.en || campaign.title.de;
  const question = isDe ? campaign.question.de || campaign.question.en : campaign.question.en || campaign.question.de;
  const description = isDe
    ? campaign.description.de || campaign.description.en
    : campaign.description.en || campaign.description.de;

  let revealData: {
    ranked: Array<{ itemRefId: string; voteCount: number }>;
    totalVoters: number;
  } | null = null;

  if (campaign.status === "closed") {
    const allVotes = await UpvoteVote.find({ campaignId: campaign._id })
      .select("userId itemRefId")
      .lean();
    const flat = allVotes.map((v) => ({
      userId: v.userId.toString(),
      itemRefId: v.itemRefId.toString(),
    }));
    const itemIds = items.map((c) => c._id);
    const positions = new Map(items.map((c) => [c._id, c.position]));
    revealData = {
      ranked: rankAggregatedVotes(aggregateVotes(flat, itemIds), positions),
      totalVoters: countUniqueVoters(flat),
    };
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${lang}/votes`}
        className="inline-block text-sm text-text-secondary hover:text-text-primary"
      >
        ← {dict["detailBack"] ?? "Back to overview"}
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
        <p className="text-lg text-text-secondary">{question}</p>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </header>

      {campaign.status === "active" ? (
        <UpvoteItemGrid
          lang={lang}
          dict={dict}
          campaignId={campaign._id.toString()}
          topN={campaign.topN}
          items={items}
          initialPicks={myPicks}
        />
      ) : revealData ? (
        <UpvoteReveal
          lang={lang}
          dict={dict}
          items={items}
          ranked={revealData.ranked}
          totalVoters={revealData.totalVoters}
          myPicks={myPicks}
        />
      ) : null}
    </div>
  );
}
