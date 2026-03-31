import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";

/**
 * GET /api/battles/[id]/pulls
 * Fetch all PackPull entries for the current user in this battle.
 * Used after a battle to show the claim/convert review screen.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const pulls = await PackPull.find({
    battleId: id,
    userId: session.user.id,
  })
    .populate("cardId", "name image")
    .sort({ createdAt: 1, cardIndex: 1 })
    .lean();

  return NextResponse.json({
    pulls: pulls.map((p) => ({
      _id: String(p._id),
      cardId: String(p.cardId?._id ?? p.cardId),
      name: (p.cardId as unknown as { name?: string })?.name ?? "Unknown",
      image: (p.cardId as unknown as { image?: string })?.image ?? null,
      rarity: p.rarity,
      coinValue: p.coinValue,
      conversionValue: p.conversionValue,
      status: p.status,
      packGroupId: p.packGroupId,
      cardIndex: p.cardIndex,
      packIndex: p.packIndex,
    })),
  });
}
