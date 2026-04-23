import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Box from "@/models/box";

export const dynamic = "force-dynamic";

/**
 * Returns the single published box marked `isTutorial: true`. Used by the
 * onboarding tour to know where to send the user. A partial unique index
 * guarantees at most one exists at a time. 404 when none is configured —
 * tour should then fall back to a skip path.
 */
export async function GET() {
  try {
    await connectDB();
    const box = await Box.findOne({
      isTutorial: true,
      status: "published",
    })
      .select("_id slug name priceInCoins image game")
      .lean();

    if (!box) {
      return NextResponse.json(
        { error: "no_tutorial_box" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: box._id.toString(),
      slug: box.slug,
      name: box.name,
      priceInCoins: box.priceInCoins,
      image: box.image,
      game: box.game,
    });
  } catch (err) {
    console.error("[tutorial-box GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
