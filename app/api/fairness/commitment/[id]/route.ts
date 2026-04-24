import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackOpenCommitment from "@/models/pack-open-commitment";
import FairnessSeed from "@/models/fairness-seed";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import Box from "@/models/box";

/**
 * Full commitment payload for the verifier page. Reveals the serverSeed
 * only if the seed's status is already "revealed" (user rotated after the
 * open). Otherwise only the committed hash is exposed.
 *
 * Scoped to the owner — a user cannot pull another user's commitment, even
 * if they guess the id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();

    const commitment = await PackOpenCommitment.findOne({
      _id: id,
      userId,
    }).lean();
    if (!commitment) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Load the referenced seed including serverSeed (we'll only return the
    // plain value if status is "revealed").
    const seed = await FairnessSeed.findById(commitment.serverSeedId)
      .select("+serverSeed")
      .lean();
    if (!seed) {
      // Dangling commitment — log but return generic error so we don't
      // confirm referential-integrity state to clients.
      console.error(
        "[fairness/commitment GET] dangling serverSeedId",
        { commitmentId: commitment._id.toString(), seedId: commitment.serverSeedId.toString() },
      );
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    const pulls = await PackPull.find({
      fairnessCommitmentId: commitment._id,
    })
      .select(
        "_id cardId rarity coinValue conversionValue status packIndex cardIndex fairnessNonce createdAt",
      )
      .sort({ fairnessNonce: 1 })
      .lean();

    // Card names for the pool snapshot table. Also pull the box name for
    // the header block.
    const cardIds = commitment.poolSnapshot.map((e) => e.cardId);
    const [cards, box] = await Promise.all([
      Card.find({ _id: { $in: cardIds } }).select("_id name image").lean(),
      Box.findById(commitment.boxId).select("_id name slug").lean(),
    ]);
    const cardById = new Map(
      cards.map((c) => [c._id.toString(), c] as const),
    );

    return NextResponse.json({
      commitment: {
        id: commitment._id.toString(),
        packGroupId: commitment.packGroupId,
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
        serverSeed: seed.status === "revealed" ? seed.serverSeed : null,
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
    console.error("[fairness/commitment GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
