import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import Binder from "@/models/binder";
import connectDB from "@/lib/db";
import { serializeBinderSummary } from "@/lib/binders/serialize";

const PAGE_SIZE = 24;
type SortMode = "recent" | "top";

interface RecentCursor {
  publishedAt: Date;
  id: Types.ObjectId;
}

interface TopCursor {
  likeCount: number;
  publishedAt: Date;
  id: Types.ObjectId;
}

function parseCursor(raw: string | null, mode: SortMode): RecentCursor | TopCursor | null {
  if (!raw) return null;
  const parts = raw.split("_");
  if (mode === "recent") {
    if (parts.length !== 2) return null;
    const ts = new Date(parts[0]);
    if (Number.isNaN(ts.getTime()) || !Types.ObjectId.isValid(parts[1])) return null;
    return { publishedAt: ts, id: new Types.ObjectId(parts[1]) };
  }
  if (parts.length !== 3) return null;
  const likeCount = Number.parseInt(parts[0], 10);
  const ts = new Date(parts[1]);
  if (
    !Number.isFinite(likeCount) ||
    Number.isNaN(ts.getTime()) ||
    !Types.ObjectId.isValid(parts[2])
  ) {
    return null;
  }
  return { likeCount, publishedAt: ts, id: new Types.ObjectId(parts[2]) };
}

function cursorFilter(
  mode: SortMode,
  cursor: RecentCursor | TopCursor | null,
): Record<string, unknown> | null {
  if (!cursor) return null;
  if (mode === "recent") {
    const c = cursor as RecentCursor;
    return {
      $or: [
        { publishedAt: { $lt: c.publishedAt } },
        { publishedAt: c.publishedAt, _id: { $lt: c.id } },
      ],
    };
  }
  const c = cursor as TopCursor;
  return {
    $or: [
      { likeCount: { $lt: c.likeCount } },
      { likeCount: c.likeCount, publishedAt: { $lt: c.publishedAt } },
      { likeCount: c.likeCount, publishedAt: c.publishedAt, _id: { $lt: c.id } },
    ],
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sortParam = url.searchParams.get("sort") === "top" ? "top" : "recent";
  const game = url.searchParams.get("game");

  const sort: Record<string, 1 | -1> =
    sortParam === "top"
      ? { likeCount: -1, publishedAt: -1, _id: -1 }
      : { publishedAt: -1, _id: -1 };

  const baseFilter: Record<string, unknown> = { isPublic: true };
  if (game) baseFilter["setTemplate.game"] = game;

  const cursor = parseCursor(url.searchParams.get("cursor"), sortParam);
  const after = cursorFilter(sortParam, cursor);
  const filter = after ? { $and: [baseFilter, after] } : baseFilter;

  await connectDB();
  const binders = await Binder.find(filter).sort(sort).limit(PAGE_SIZE + 1);

  let nextCursor: string | null = null;
  let pageBinders = binders;
  if (binders.length > PAGE_SIZE) {
    pageBinders = binders.slice(0, PAGE_SIZE);
    const last = pageBinders[pageBinders.length - 1];
    const publishedIso = last.publishedAt?.toISOString() ?? "";
    nextCursor =
      sortParam === "top"
        ? `${last.likeCount}_${publishedIso}_${last._id.toString()}`
        : `${publishedIso}_${last._id.toString()}`;
  }

  return NextResponse.json({
    binders: pageBinders.map(serializeBinderSummary),
    nextCursor,
  });
}
