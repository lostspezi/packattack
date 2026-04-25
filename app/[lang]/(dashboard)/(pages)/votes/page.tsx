import Link from "next/link";
import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import UpvoteCampaign from "@/models/upvote-campaign";
import UpvoteVote from "@/models/upvote-vote";
import { autoCloseExpiredBulk } from "@/lib/votes/auto-close";
import { Badge } from "@/components/ui/badge";

export default async function VotesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${lang}/login`);
  }
  const userId = session.user.id;

  const dict = await getDictionary(lang as Locale, "votes");
  const isDe = lang === "de";

  await connectDB();
  await autoCloseExpiredBulk();

  const campaigns = await UpvoteCampaign.find({ status: { $in: ["active", "closed"] } })
    .select("_id title question status topN endsAt closedAt createdAt")
    .sort({ status: 1, endsAt: 1, closedAt: -1, createdAt: -1 })
    .lean();

  const myVotes = campaigns.length
    ? await UpvoteVote.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            campaignId: { $in: campaigns.map((c) => c._id) },
            userId: new Types.ObjectId(userId),
          },
        },
        { $group: { _id: "$campaignId", count: { $sum: 1 } } },
      ])
    : [];
  const myCountByCampaign = new Map(myVotes.map((v) => [v._id.toString(), v.count]));

  const active = campaigns.filter((c) => c.status === "active");
  const closed = campaigns.filter((c) => c.status === "closed");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-text-primary">
          {dict["pageTitle"] ?? "Votes"}
        </h1>
        <p className="text-text-secondary mt-1">
          {dict["pageSubtitle"] ?? "Vote on the cards that should land next."}
        </p>
      </header>

      {campaigns.length === 0 && (
        <p className="text-sm text-text-muted">{dict["listEmpty"] ?? "No votes are running right now."}</p>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {dict["listOpenSection"] ?? "Live votes"}
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map((c) => {
              const myCount = myCountByCampaign.get(c._id.toString()) ?? 0;
              const title = isDe ? c.title.de || c.title.en : c.title.en || c.title.de;
              const question = isDe ? c.question.de || c.question.en : c.question.en || c.question.de;
              return (
                <li key={c._id.toString()}>
                  <Link
                    href={`/${lang}/votes/${c._id.toString()}`}
                    className="block p-4 bg-surface rounded-lg border border-border hover:border-pa-green/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-text-primary">{title}</h3>
                      <Badge variant="success">{dict["statusActive"] ?? "Live"}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2">{question}</p>
                    <p className="text-xs text-text-muted mt-2">
                      {myCount > 0
                        ? `${dict["selectionCounter"] ?? "{{selected}} of {{max}} selected"}`
                            .replace("{{selected}}", String(myCount))
                            .replace("{{max}}", String(c.topN))
                        : `${dict["pickInstructions"] ?? "Pick up to {{max}} cards."}`.replace(
                            "{{max}}",
                            String(c.topN)
                          )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {dict["listClosedSection"] ?? "Closed votes"}
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {closed.map((c) => {
              const title = isDe ? c.title.de || c.title.en : c.title.en || c.title.de;
              const question = isDe ? c.question.de || c.question.en : c.question.en || c.question.de;
              return (
                <li key={c._id.toString()}>
                  <Link
                    href={`/${lang}/votes/${c._id.toString()}`}
                    className="block p-4 bg-surface rounded-lg border border-border hover:border-pa-green/40 transition-colors opacity-90"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-text-primary">{title}</h3>
                      <Badge variant="user">{dict["statusClosed"] ?? "Closed"}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2">{question}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
