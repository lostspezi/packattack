import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackOpenCommitment from "@/models/pack-open-commitment";
import FairnessSeed from "@/models/fairness-seed";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import Box from "@/models/box";
import AdminFairnessAccessLog from "@/models/admin-fairness-access-log";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

/**
 * Admin commitment read. Unlike the user-scoped endpoint this exposes the
 * plain server seed even for active (not-yet-revealed) seeds — required for
 * incident investigations. Every such read is logged to
 * AdminFairnessAccessLog append-only so admins can't silently peek.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !adminId || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();

    const commitment = await PackOpenCommitment.findById(id).lean();
    if (!commitment) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const seed = await FairnessSeed.findById(commitment.serverSeedId)
      .select("+serverSeed")
      .lean();
    if (!seed) {
      console.error(
        "[admin/fairness/commitment] dangling serverSeedId",
        { commitmentId: commitment._id.toString(), seedId: commitment.serverSeedId.toString() },
      );
      // Even a failed seed read is an attempt worth auditing.
      await AdminFairnessAccessLog.create({
        adminId: new Types.ObjectId(adminId),
        targetUserId: commitment.userId,
        targetSeedId: commitment.serverSeedId,
        targetCommitmentId: commitment._id,
        accessType: "view_commitment",
        context: "api admin commitment — dangling seed",
      }).catch((e) => console.error("[admin audit write]", e));
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    // Audit: log the admin reading a server seed. This write is best-effort
    // but we await it so a dropped log returns 500 rather than silently
    // exposing the seed.
    await AdminFairnessAccessLog.create({
      adminId: new Types.ObjectId(adminId),
      targetUserId: commitment.userId,
      targetSeedId: seed._id,
      targetCommitmentId: commitment._id,
      accessType: "view_commitment",
      context: `admin fairness commitment view; seed.status=${seed.status}`,
    });

    const pulls = await PackPull.find({ fairnessCommitmentId: commitment._id })
      .select(
        "_id cardId rarity coinValue conversionValue status packIndex cardIndex fairnessNonce createdAt",
      )
      .sort({ fairnessNonce: 1 })
      .lean();

    const cardIds = [
      ...commitment.poolSnapshot.map((e) => e.cardId),
      ...pulls.map((p) => p.cardId),
    ];
    const [cards, box] = await Promise.all([
      Card.find({ _id: { $in: cardIds } }).select("_id name image").lean(),
      Box.findById(commitment.boxId).select("_id name slug").lean(),
    ]);
    const cardById = new Map(cards.map((c) => [c._id.toString(), c] as const));

    return NextResponse.json({
      commitment: {
        id: commitment._id.toString(),
        userId: commitment.userId.toString(),
        packGroupId: String(commitment.packGroupId),
        boxId: commitment.boxId.toString(),
        boxName: box?.name ?? null,
        boxSlug: box?.slug ?? null,
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
        createdAt: commitment.createdAt,
      },
      seed: {
        id: seed._id.toString(),
        status: seed.status,
        serverSeedHash: seed.serverSeedHash,
        serverSeed: seed.serverSeed ?? null,
        activatedAt: seed.activatedAt,
        revealedAt: seed.revealedAt,
      },
      pulls: pulls.map((p) => ({
        id: p._id.toString(),
        cardId: p.cardId.toString(),
        cardName: cardById.get(p.cardId.toString())?.name ?? "Unknown",
        cardImage: cardById.get(p.cardId.toString())?.image ?? null,
        rarity: p.rarity,
        coinValue: p.coinValue,
        conversionValue: p.conversionValue,
        status: p.status,
        packIndex: p.packIndex,
        cardIndex: p.cardIndex,
        nonce: p.fairnessNonce,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/fairness/commitment GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
