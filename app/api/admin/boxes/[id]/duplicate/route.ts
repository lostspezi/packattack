import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name } = body as { name?: { de: string; en: string } };

  if (!name?.de || !name?.en) {
    return NextResponse.json({ error: "name.de and name.en are required" }, { status: 400 });
  }

  try {
    await connectDB();

    const source = await Box.findById(id).lean();
    if (!source) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const duplicate = await Box.create({
      name,
      description: source.description,
      game: source.game,
      image: source.image,
      status: "draft",
      priceInCoins: source.priceInCoins,
      cardsPerPack: source.cardsPerPack,
      totalPacks: source.totalPacks,
      packsOpened: 0,
      rarityWeights: source.rarityWeights,
      cards: source.cards,
      createdBy: userId,
    });

    return NextResponse.json({ _id: duplicate._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[admin/boxes/[id]/duplicate POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
