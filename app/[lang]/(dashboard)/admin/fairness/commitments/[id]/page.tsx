import { redirect, notFound } from "next/navigation";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackOpenCommitment from "@/models/pack-open-commitment";
import FairnessSeed from "@/models/fairness-seed";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import Box from "@/models/box";
import User from "@/models/user";
import AdminFairnessAccessLog from "@/models/admin-fairness-access-log";
import Verifier from "@/components/fairness/Verifier";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

interface PageProps {
  params: Promise<{ lang: string; id: string }>;
}

export const metadata = { title: "Commitment Detail — Admin" };

export default async function AdminCommitmentPage({ params }: PageProps) {
  const { lang, id } = await params;

  const session = await auth();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !adminId || !isAdminRole(role)) {
    redirect(`/${lang}/dashboard`);
  }

  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();

  const commitment = await PackOpenCommitment.findById(id).lean();
  if (!commitment) notFound();

  const seed = await FairnessSeed.findById(commitment.serverSeedId)
    .select("+serverSeed")
    .lean();
  if (!seed) {
    // Log the attempted seed read even when the seed doc is missing — the
    // audit trail must reflect every admin attempt to view a server seed,
    // including ones that fail due to data inconsistency.
    await AdminFairnessAccessLog.create({
      adminId: new Types.ObjectId(adminId),
      targetUserId: commitment.userId,
      targetSeedId: commitment.serverSeedId,
      targetCommitmentId: commitment._id,
      accessType: "view_commitment",
      context: "admin ui commitment page — dangling seed",
    });
    notFound();
  }

  // Audit log: admin viewed a commitment with full server seed.
  await AdminFairnessAccessLog.create({
    adminId: new Types.ObjectId(adminId),
    targetUserId: commitment.userId,
    targetSeedId: seed._id,
    targetCommitmentId: commitment._id,
    accessType: "view_commitment",
    context: `admin ui commitment page; seed.status=${seed.status}`,
  });

  const [pulls, targetUser] = await Promise.all([
    PackPull.find({ fairnessCommitmentId: commitment._id })
      .select("_id cardId rarity coinValue fairnessNonce")
      .sort({ fairnessNonce: 1 })
      .lean(),
    User.findById(commitment.userId).select("_id username email").lean(),
  ]);

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
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Commitment (Admin-View)</h1>
        <p className="text-text-secondary text-sm">
          User: {targetUser?.username || targetUser?.email || commitment.userId.toString()} ·
          Seed-Status: <span className="font-mono">{seed.status}</span>
        </p>
        <p className="text-text-secondary text-xs">
          Dein Zugriff auf den Server-Seed wurde ins Audit-Log geschrieben.
        </p>
      </header>

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
            const c = cardById.get(e.cardId.toString());
            return {
              cardId: e.cardId.toString(),
              cardName: c?.name ?? "Unknown",
              cardImage: c?.image ?? null,
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
          id: seed._id.toString(),
          status: seed.status,
          serverSeedHash: seed.serverSeedHash,
          // Admin-only path: we return the plain seed regardless of status.
          serverSeed: seed.serverSeed ?? null,
          activatedAt:
            seed.activatedAt instanceof Date
              ? seed.activatedAt.toISOString()
              : String(seed.activatedAt),
          revealedAt: seed.revealedAt
            ? seed.revealedAt instanceof Date
              ? seed.revealedAt.toISOString()
              : String(seed.revealedAt)
            : null,
        }}
        pulls={pulls.map((p) => {
          const c = cardById.get(p.cardId.toString());
          return {
            id: p._id.toString(),
            cardId: p.cardId.toString(),
            cardName: c?.name ?? "Unknown",
            cardImage: c?.image ?? null,
            rarity: p.rarity,
            coinValue: p.coinValue,
            nonce: p.fairnessNonce ?? null,
          };
        })}
      />
    </div>
  );
}
