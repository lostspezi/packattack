import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";

const PAGE_SIZE = 50;

type Cursor = { createdAt: string; id: string };

function encodeCursor(createdAt: Date, id: Types.ObjectId): string {
  // Truncate to millisecond precision so the Date round-trips losslessly
  // via ISO string — otherwise sub-ms timestamps would miss page-boundary
  // rows on the $or tie-breaker branch.
  const ms = new Date(Math.floor(createdAt.getTime()));
  const json = JSON.stringify({ createdAt: ms.toISOString(), id: id.toString() });
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<Cursor>;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      !Types.ObjectId.isValid(parsed.id) ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Escape a string for safe use inside a regex literal. We only allow the
 * search string from the client as a prefix/substring match, never as a
 * regex pattern.
 */
function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get("cursor");
  const boxFilter = url.searchParams.get("box");
  const rarityFilter = url.searchParams.get("rarity");
  const statusFilter = url.searchParams.get("status");
  const query = url.searchParams.get("q")?.trim() ?? "";

  try {
    await connectDB();

    const match: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (boxFilter && Types.ObjectId.isValid(boxFilter)) {
      match.boxId = new Types.ObjectId(boxFilter);
    }
    if (rarityFilter) match.rarity = rarityFilter;
    if (statusFilter) match.status = statusFilter;

    // Full-text-ish card-name match: resolve matching card IDs first so the
    // main aggregation stays on the indexed userId+createdAt path.
    if (query.length >= 1 && query.length <= 64) {
      const nameRegex = new RegExp(escapeRegex(query), "i");
      const matchingCardIds = await Card.find({ name: nameRegex })
        .select("_id")
        .limit(500)
        .lean();
      match.cardId = { $in: matchingCardIds.map((c) => c._id) };
    }

    if (cursorRaw) {
      const decoded = decodeCursor(cursorRaw);
      if (!decoded) {
        return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
      }
      const cursorDate = new Date(decoded.createdAt);
      const cursorId = new Types.ObjectId(decoded.id);
      // Tie-breaker on _id so pulls sharing a createdAt don't duplicate or
      // skip across pages.
      match.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } },
      ];
    }

    const rows = await PackPull.aggregate([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: PAGE_SIZE + 1 },
      {
        $lookup: {
          from: "cards",
          localField: "cardId",
          foreignField: "_id",
          as: "card",
        },
      },
      {
        $lookup: {
          from: "boxes",
          localField: "boxId",
          foreignField: "_id",
          as: "box",
        },
      },
      { $unwind: { path: "$card", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$box", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          packGroupId: 1,
          packIndex: 1,
          cardIndex: 1,
          status: 1,
          rarity: 1,
          coinValue: 1,
          conversionValue: 1,
          cardId: 1,
          cardName: "$card.name",
          cardImage: "$card.image",
          boxId: 1,
          boxName: "$box.name",
          boxSlug: "$box.slug",
          fairnessCommitmentId: 1,
          fairnessNonce: 1,
        },
      },
    ]);

    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.createdAt as Date, last._id as Types.ObjectId)
      : null;

    return NextResponse.json({
      items: items.map((r) => ({
        id: (r._id as Types.ObjectId).toString(),
        createdAt: r.createdAt,
        packGroupId: r.packGroupId,
        packIndex: r.packIndex,
        cardIndex: r.cardIndex,
        status: r.status,
        rarity: r.rarity,
        coinValue: r.coinValue,
        conversionValue: r.conversionValue,
        card: {
          id: (r.cardId as Types.ObjectId).toString(),
          name: r.cardName ?? "Unknown",
          image: r.cardImage ?? null,
        },
        box: {
          id: (r.boxId as Types.ObjectId).toString(),
          name: r.boxName ?? null,
          slug: r.boxSlug ?? null,
        },
        fairness: r.fairnessCommitmentId
          ? {
              commitmentId: (r.fairnessCommitmentId as Types.ObjectId).toString(),
              nonce: r.fairnessNonce ?? null,
            }
          : null,
      })),
      nextCursor,
    });
  } catch (err) {
    console.error("[account/history GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
