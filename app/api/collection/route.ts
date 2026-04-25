import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";

const PAGE_SIZE = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const game = url.searchParams.get("game");
  const set = url.searchParams.get("set");
  const rarity = url.searchParams.get("rarity");
  const search = url.searchParams.get("q")?.trim();
  const onlyFree = url.searchParams.get("onlyFree") === "1";
  const sortParam = url.searchParams.get("sort") ?? "recent";
  const cursor = url.searchParams.get("cursor");

  const userObjId = new Types.ObjectId(userId);

  const cardFilter: Record<string, unknown> = {};
  if (game) cardFilter.game = game;
  if (set) cardFilter.set = set;
  if (rarity) cardFilter.rarity = rarity;
  if (search) cardFilter.name = { $regex: escapeRegExp(search), $options: "i" };

  let cardIdFilter: Types.ObjectId[] | null = null;
  if (Object.keys(cardFilter).length > 0) {
    const cards = await Card.find(cardFilter).select("_id").limit(5000).lean();
    cardIdFilter = cards.map((c) => c._id as Types.ObjectId);
    if (cardIdFilter.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
  }

  const pullFilter: Record<string, unknown> = {
    userId: userObjId,
    status: "claimed",
  };
  if (cardIdFilter) pullFilter.cardId = { $in: cardIdFilter };
  if (onlyFree) pullFilter.binderId = null;

  const sort: Record<string, 1 | -1> =
    sortParam === "name"
      ? { _id: -1 }
      : { createdAt: -1, _id: -1 };

  if (cursor) {
    const [createdAtIso, id] = cursor.split("_");
    if (createdAtIso && id) {
      const parsedTs = new Date(createdAtIso);
      if (!Number.isNaN(parsedTs.getTime())) {
        pullFilter.createdAt = { $lte: parsedTs };
        pullFilter._id = { $lt: new Types.ObjectId(id) };
      }
    }
  }

  await connectDB();
  const pulls = await PackPull.find(pullFilter)
    .sort(sort)
    .limit(PAGE_SIZE + 1)
    .lean();

  let pagePulls = pulls;
  let nextCursor: string | null = null;
  if (pulls.length > PAGE_SIZE) {
    pagePulls = pulls.slice(0, PAGE_SIZE);
    const last = pagePulls[pagePulls.length - 1];
    nextCursor = `${last.createdAt.toISOString()}_${last._id.toString()}`;
  }

  const cardIds = Array.from(
    new Set(pagePulls.map((p) => p.cardId.toString())),
  ).map((id) => new Types.ObjectId(id));
  const cards = await Card.find({ _id: { $in: cardIds } })
    .select("_id name game set setName rarity image")
    .lean();
  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const items = pagePulls
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
        binderId: p.binderId ? p.binderId.toString() : null,
        createdAt: p.createdAt.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ items, nextCursor });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
