import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import PackOpenCommitment from "@/models/pack-open-commitment";
import FairnessSeed from "@/models/fairness-seed";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import Box from "@/models/box";
import Verifier from "@/components/fairness/Verifier";

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ commitmentId?: string; pullId?: string }>;
}

export const metadata = {
  title: "Pull verifizieren — PACKATTACK",
};

export default async function VerifyPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  const { commitmentId: queryCommitmentId, pullId } = await searchParams;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    redirect(`/${lang}/login?callbackUrl=/${lang}/provably-fair/verify`);
  }

  let resolvedCommitmentId = queryCommitmentId ?? null;
  if (!resolvedCommitmentId && pullId && Types.ObjectId.isValid(pullId)) {
    await connectDB();
    const pull = await PackPull.findOne({ _id: pullId, userId })
      .select("fairnessCommitmentId")
      .lean();
    resolvedCommitmentId = pull?.fairnessCommitmentId?.toString() ?? null;
  }

  if (!resolvedCommitmentId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Verifier</h1>
        <p className="text-text-secondary mb-4">
          Hier rechnet dein Browser einen Pull eigenständig nach. Öffne deine{" "}
          <Link href={`/${lang}/account/history`} className="text-pa-green">
            Pull-History
          </Link>{" "}
          und klick bei einem Pull auf <span className="text-pa-green">Verify</span>.
        </p>
      </div>
    );
  }

  if (!Types.ObjectId.isValid(resolvedCommitmentId)) {
    notFound();
  }

  await connectDB();

  const commitment = await PackOpenCommitment.findOne({
    _id: resolvedCommitmentId,
    userId,
  }).lean();
  if (!commitment) notFound();

  // First fetch without the plaintext seed to decide whether to reveal.
  // Defence-in-depth: a raw serverSeed never sits in the request heap when
  // status is still "active", even during an error/boundary render.
  const seedMeta = await FairnessSeed.findById(commitment.serverSeedId)
    .select("status serverSeedHash activatedAt revealedAt")
    .lean();
  if (!seedMeta) notFound();

  let revealedSeedValue: string | null = null;
  if (seedMeta.status === "revealed") {
    const seedWithValue = await FairnessSeed.findById(commitment.serverSeedId)
      .select("+serverSeed")
      .lean();
    revealedSeedValue = seedWithValue?.serverSeed ?? null;
  }

  const pulls = await PackPull.find({ fairnessCommitmentId: commitment._id })
    .select("_id cardId rarity coinValue fairnessNonce")
    .sort({ fairnessNonce: 1 })
    .lean();

  const cardIds = [
    ...commitment.poolSnapshot.map((e) => e.cardId),
    ...pulls.map((p) => p.cardId),
  ];
  const [cards, box] = await Promise.all([
    Card.find({ _id: { $in: cardIds } }).select("_id name image").lean(),
    Box.findById(commitment.boxId).select("_id name").lean(),
  ]);
  const cardById = new Map(cards.map((c) => [c._id.toString(), c] as const));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pull verifizieren</h1>
        <p className="text-text-secondary">
          Dein Browser rechnet jetzt nach. Keine Daten verlassen dein Gerät.
        </p>
      </div>

      <Verifier
        commitment={{
          id: commitment._id.toString(),
          packGroupId: String(commitment.packGroupId),
          boxId: commitment.boxId.toString(),
          boxName: box?.name ?? null,
          clientSeed: commitment.clientSeed,
          nonceStart: commitment.nonceStart,
          nonceEnd: commitment.nonceEnd,
          poolHash: commitment.poolHash,
          serverSeedHashAtOpen: commitment.serverSeedHashAtOpen,
          poolSnapshot: commitment.poolSnapshot.map((e) => {
            const card = cardById.get(e.cardId.toString());
            return {
              cardId: e.cardId.toString(),
              cardName: card?.name ?? "Unknown",
              cardImage: card?.image ?? null,
              weight: e.weight,
              stockAtOpen: e.stockAtOpen,
            };
          }),
          createdAt:
            commitment.createdAt instanceof Date
              ? commitment.createdAt.toISOString()
              : String(commitment.createdAt),
        }}
        seed={{
          id: seedMeta._id.toString(),
          status: seedMeta.status,
          serverSeedHash: seedMeta.serverSeedHash,
          serverSeed: revealedSeedValue,
          activatedAt:
            seedMeta.activatedAt instanceof Date
              ? seedMeta.activatedAt.toISOString()
              : String(seedMeta.activatedAt),
          revealedAt: seedMeta.revealedAt
            ? seedMeta.revealedAt instanceof Date
              ? seedMeta.revealedAt.toISOString()
              : String(seedMeta.revealedAt)
            : null,
        }}
        pulls={pulls.map((p) => {
          const card = cardById.get(p.cardId.toString());
          return {
            id: p._id.toString(),
            cardId: p.cardId.toString(),
            cardName: card?.name ?? "Unknown",
            cardImage: card?.image ?? null,
            rarity: p.rarity,
            coinValue: p.coinValue,
            nonce: p.fairnessNonce ?? null,
          };
        })}
      />
    </div>
  );
}
