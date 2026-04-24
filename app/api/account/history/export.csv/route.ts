import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Card from "@/models/card";

// Hard upper bound on rows per export request. Matches what fits comfortably
// in a browser download; if we ever need more we'll ship streaming.
const EXPORT_ROW_LIMIT = 10_000;

/**
 * Escape a single CSV field per RFC 4180.
 * Wraps in double quotes and doubles any inner double quotes.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise formula-trigger prefixes that Excel/LibreOffice interpret on
  // open — card and box names are user-adjacent strings so this is a real
  // exfil risk, not just a cosmetic concern.
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
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

    if (query.length >= 1 && query.length <= 64) {
      const nameRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingCardIds = await Card.find({ name: nameRegex })
        .select("_id")
        .limit(500)
        .lean();
      match.cardId = { $in: matchingCardIds.map((c) => c._id) };
    }

    const rows = await PackPull.aggregate([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      // Over-fetch by one so we can signal truncation to the user instead
      // of silently dropping the oldest history.
      { $limit: EXPORT_ROW_LIMIT + 1 },
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
          createdAt: 1,
          rarity: 1,
          coinValue: 1,
          conversionValue: 1,
          status: 1,
          packGroupId: 1,
          packIndex: 1,
          cardIndex: 1,
          cardName: "$card.name",
          boxName: "$box.name",
        },
      },
    ]);

    const truncated = rows.length > EXPORT_ROW_LIMIT;
    const exportRows = truncated ? rows.slice(0, EXPORT_ROW_LIMIT) : rows;

    const header = [
      "timestamp",
      "box",
      "card",
      "rarity",
      "coin_value",
      "conversion_value",
      "status",
      "pack_group",
      "pack_index",
      "card_index",
    ];

    const csvLines = [header.join(",")];
    for (const r of exportRows) {
      const createdAt = r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt;
      const boxName =
        r.boxName && typeof r.boxName === "object"
          ? r.boxName.de ?? r.boxName.en ?? ""
          : r.boxName ?? "";
      csvLines.push(
        [
          csvCell(createdAt),
          csvCell(boxName),
          csvCell(r.cardName),
          csvCell(r.rarity),
          csvCell(r.coinValue),
          csvCell(r.conversionValue),
          csvCell(r.status),
          csvCell(r.packGroupId),
          csvCell(r.packIndex),
          csvCell(r.cardIndex),
        ].join(","),
      );
    }

    const csv = csvLines.join("\r\n");
    const filename = `packattack-history-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        "x-export-truncated": truncated ? "true" : "false",
        "x-export-row-count": String(exportRows.length),
      },
    });
  } catch (err) {
    console.error("[account/history export.csv GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
