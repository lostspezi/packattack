import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import BinderLike from "@/models/binder-like";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";
import { updateBinderSchema } from "@/lib/binders/validations";
import { resolveAccess } from "@/lib/binders/public-access";
import { serializeBinder } from "@/lib/binders/serialize";
import { withTxnOrSequential } from "@/lib/binders/with-transaction";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const viewerId =
    (session?.user as { id?: string } | undefined)?.id ?? null;

  const { slug } = await params;
  await connectDB();

  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const access = resolveAccess(binder, viewerId);
  if (access === "denied") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const placedPullIds = new Set<string>();
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (slot.packPullId) placedPullIds.add(slot.packPullId.toString());
    }
  }
  const expectedCardIds = new Set<string>();
  for (const page of binder.pages) {
    for (const slot of page.slots) {
      if (slot.expectedCardId) {
        expectedCardIds.add(slot.expectedCardId.toString());
      }
    }
  }

  const placedPulls =
    placedPullIds.size > 0
      ? await PackPull.find({
          _id: {
            $in: Array.from(placedPullIds).map((id) => new Types.ObjectId(id)),
          },
        })
          .select("_id cardId createdAt")
          .lean()
      : [];

  const cardIds = new Set<string>();
  for (const pull of placedPulls) cardIds.add(pull.cardId.toString());
  for (const id of expectedCardIds) cardIds.add(id);

  const cards = cardIds.size
    ? await Card.find({
        _id: {
          $in: Array.from(cardIds).map((id) => new Types.ObjectId(id)),
        },
      })
        .select("_id name game set setName rarity image")
        .lean()
    : [];
  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const placedCards = placedPulls
    .map((p) => {
      const card = cardMap.get(p.cardId.toString());
      if (!card) return null;
      return {
        packPullId: p._id.toString(),
        cardId: card._id.toString(),
        name: card.name,
        game: card.game,
        set: card.set,
        setName: card.setName,
        rarity: card.rarity,
        image: card.image ?? null,
        createdAt: p.createdAt.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const expectedCardsList = Array.from(expectedCardIds)
    .map((id) => cardMap.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      cardId: c._id.toString(),
      name: c.name,
      game: c.game,
      set: c.set,
      setName: c.setName,
      rarity: c.rarity,
      image: c.image ?? null,
    }));

  return NextResponse.json({
    binder: serializeBinder(binder),
    access,
    placedCards,
    expectedCards: expectedCardsList,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateBinderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();

  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updates = parsed.data;
  if (updates.name !== undefined) binder.name = updates.name;
  if (updates.description !== undefined)
    binder.description = updates.description;
  if (updates.theme !== undefined) binder.theme = updates.theme;
  if (updates.coverPackPullId !== undefined) {
    if (updates.coverPackPullId === null) {
      binder.coverPackPullId = null;
    } else {
      const cover = await PackPull.findOne({
        _id: updates.coverPackPullId,
        userId: binder.userId,
      })
        .select("_id")
        .lean();
      if (!cover) {
        return NextResponse.json(
          { error: "cover_not_owned" },
          { status: 400 },
        );
      }
      binder.coverPackPullId = cover._id;
    }
  }
  if (updates.isPublic !== undefined) {
    if (updates.isPublic && !binder.isPublic) {
      binder.publishedAt = new Date();
    }
    binder.isPublic = updates.isPublic;
  }

  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  await connectDB();

  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await withTxnOrSequential(async (txn) => {
    await PackPull.updateMany(
      { binderId: binder._id, userId: binder.userId },
      { $set: { binderId: null } },
      txn ? { session: txn } : {},
    );
    await BinderLike.deleteMany(
      { binderId: binder._id },
      txn ? { session: txn } : {},
    );
    await binder.deleteOne(txn ? { session: txn } : undefined);
  });

  return NextResponse.json({ success: true });
}
