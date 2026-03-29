import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Season, { type ISeasonReward } from "@/models/season";

export async function GET(_req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const seasons = await Season.find().sort({ number: -1 }).lean();

    return NextResponse.json({
      seasons: seasons.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        number: s.number,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        rewards: s.rewards,
      })),
    });
  } catch (err) {
    console.error("[admin/seasons GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (
    !b.name ||
    typeof (b.name as Record<string, unknown>).de !== "string" ||
    typeof (b.name as Record<string, unknown>).en !== "string" ||
    !b.number ||
    !b.startsAt ||
    !b.endsAt ||
    !b.status
  ) {
    return NextResponse.json(
      { error: "Missing required fields: name.de, name.en, number, startsAt, endsAt, status" },
      { status: 400 }
    );
  }

  const validStatuses = ["upcoming", "active", "ended"];
  if (!validStatuses.includes(b.status as string)) {
    return NextResponse.json(
      { error: "status must be one of: upcoming, active, ended" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const nameObj = b.name as { de: string; en: string };
    const doc = new Season({
      name: { de: nameObj.de, en: nameObj.en },
      number: Number(b.number),
      startsAt: new Date(b.startsAt as string),
      endsAt: new Date(b.endsAt as string),
      status: b.status as "upcoming" | "active" | "ended",
      rewards: (b.rewards as ISeasonReward[]) ?? [],
    });
    await doc.save();

    return NextResponse.json(
      {
        _id: doc._id.toString(),
        name: doc.name,
        number: doc.number,
        startsAt: doc.startsAt,
        endsAt: doc.endsAt,
        status: doc.status,
        rewards: doc.rewards,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin/seasons POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
