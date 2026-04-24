import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { getUserEffects } from "@/lib/achievements/effects";
import { resolveDisplayTitle } from "@/lib/achievements/titles";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(userId)
      .select("equippedTitle")
      .lean<{ equippedTitle?: string | null } | null>();
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const effects = await getUserEffects(userId);
    const equipped = user.equippedTitle ?? null;
    const displayTitle = resolveDisplayTitle(effects, equipped);

    return NextResponse.json({
      availableTitles: effects.cosmetics.titles,
      equippedTitle: equipped,
      displayTitle,
    });
  } catch (err) {
    console.error("[me/cosmetics GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { equippedTitle?: string | null };
    const incoming =
      body?.equippedTitle === null || body?.equippedTitle === undefined
        ? null
        : String(body.equippedTitle).trim().slice(0, 64) || null;

    await connectDB();

    if (incoming !== null) {
      // Nur freigeschaltete Titel erlaubt — verhindert, dass ein Client per
      // PATCH einen beliebigen String als Titel setzt.
      const effects = await getUserEffects(userId);
      if (!effects.cosmetics.titles.includes(incoming)) {
        return NextResponse.json(
          { error: "title_not_unlocked" },
          { status: 400 },
        );
      }
    }

    await User.updateOne({ _id: userId }, { $set: { equippedTitle: incoming } });

    return NextResponse.json({ equippedTitle: incoming });
  } catch (err) {
    console.error("[me/cosmetics PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
