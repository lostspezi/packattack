import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import NewsPost from "@/models/news-post";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

interface Cursor {
  d: string;
  i: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed?.d === "string" && typeof parsed?.i === "string") {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT));
    const cursorRaw = searchParams.get("cursor");
    const type = searchParams.get("type");

    const filter: Record<string, unknown> = { status: "published" };
    if (type && ["release", "event", "community"].includes(type)) {
      filter.type = type;
    }
    if (cursorRaw) {
      const cursor = decodeCursor(cursorRaw);
      if (cursor) {
        const date = new Date(cursor.d);
        if (!Number.isNaN(date.getTime()) && Types.ObjectId.isValid(cursor.i)) {
          filter.$or = [
            { publishedAt: { $lt: date } },
            { publishedAt: date, _id: { $lt: new Types.ObjectId(cursor.i) } },
          ];
        }
      }
    }

    const posts = await NewsPost.find(filter)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1)
      .select("title slug excerpt type imageId imageAlt publishedAt")
      .lean();

    const hasMore = posts.length > limit;
    const sliced = hasMore ? posts.slice(0, limit) : posts;
    const items = sliced.map((p) => ({
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      type: p.type,
      imageId: p.imageId ? String(p.imageId) : null,
      imageAlt: p.imageAlt ?? "",
      publishedAt: p.publishedAt,
    }));

    let nextCursor: string | null = null;
    if (hasMore && sliced.length > 0) {
      const last = sliced[sliced.length - 1];
      if (last.publishedAt) {
        nextCursor = encodeCursor({
          d: last.publishedAt.toISOString(),
          i: String(last._id),
        });
      }
    }

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[api/news GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
