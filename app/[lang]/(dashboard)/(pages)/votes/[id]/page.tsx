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
import { UpvoteCardGrid } from "@/components/votes/upvote-card-grid";
import { UpvoteReveal } from "@/components/votes/upvote-reveal";

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
    .select("cardRefId")
    .lean();
  const myPicks = myVotes.map((v) => v.cardRefId.toString());

  const cards = campaign.cards
    .map((c) => ({
      _id: c._id.toString(),
      source: c.source,
      name: c.name,
      game: c.game,
      set: c.set,
      setName: c.setName,
      rarity: c.rarity,
      image: c.image,
      tcgplayerId: c.tcgplayerId,
      position: c.position,
    }))
    .sort((a, b) => a.position - b.position);

  const title = isDe ? campaign.title.de || campaign.title.en : campaign.title.en || campaign.title.de;
  const question = isDe ? campaign.question.de || campaign.question.en : campaign.question.en || campaign.question.de;
  const description = isDe
    ? campaign.description.de || campaign.description.en
    : campaign.description.en || campaign.description.de;

  let revealData: {
    ranked: Array<{ cardRefId: string; voteCount: number }>;
    totalVoters: number;
  } | null = null;

  if (campaign.status === "closed") {
    const allVotes = await UpvoteVote.find({ campaignId: campaign._id })
      .select("userId cardRefId")
      .lean();
    const flat = allVotes.map((v) => ({
      userId: v.userId.toString(),
      cardRefId: v.cardRefId.toString(),
    }));
    const cardIds = cards.map((c) => c._id);
    const positions = new Map(cards.map((c) => [c._id, c.position]));
    revealData = {
      ranked: rankAggregatedVotes(aggregateVotes(flat, cardIds), positions),
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
        <UpvoteCardGrid
          lang={lang}
          dict={dict}
          campaignId={campaign._id.toString()}
          topN={campaign.topN}
          cards={cards}
          initialPicks={myPicks}
        />
      ) : revealData ? (
        <UpvoteReveal
          lang={lang}
          dict={dict}
          cards={cards}
          ranked={revealData.ranked}
          totalVoters={revealData.totalVoters}
          myPicks={myPicks}
        />
      ) : null}
    </div>
  );
}
