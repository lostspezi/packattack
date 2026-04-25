import { NextRequest, NextResponse } from "next/server";
import Binder from "@/models/binder";
import connectDB from "@/lib/db";
import { serializeBinderSummary } from "@/lib/binders/serialize";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sortParam = url.searchParams.get("sort") ?? "recent";
  const game = url.searchParams.get("game");
  const cursor = url.searchParams.get("cursor");

  const sort: Record<string, 1 | -1> =
    sortParam === "top"
      ? { likeCount: -1, publishedAt: -1, _id: -1 }
      : { publishedAt: -1, _id: -1 };

  const filter: Record<string, unknown> = { isPublic: true };
  if (game) filter["setTemplate.game"] = game;

  if (cursor) {
    const [ts, id] = cursor.split("_");
    if (ts && id) {
      const parsedTs = new Date(ts);
      if (!Number.isNaN(parsedTs.getTime())) {
        if (sortParam === "top") {
          filter.publishedAt = { $lte: parsedTs };
          filter._id = { $lt: id };
        } else {
          filter.publishedAt = { $lte: parsedTs };
          filter._id = { $lt: id };
        }
      }
    }
  }

  await connectDB();
  const binders = await Binder.find(filter)
    .sort(sort)
    .limit(PAGE_SIZE + 1);

  let nextCursor: string | null = null;
  let pageBinders = binders;
  if (binders.length > PAGE_SIZE) {
    pageBinders = binders.slice(0, PAGE_SIZE);
    const last = pageBinders[pageBinders.length - 1];
    nextCursor = `${last.publishedAt?.toISOString() ?? ""}_${last._id.toString()}`;
  }

  return NextResponse.json({
    binders: pageBinders.map(serializeBinderSummary),
    nextCursor,
  });
}
