import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import UpvoteCampaign from "@/models/upvote-campaign";
import { gateAdmin } from "@/lib/admin/upvote-campaign-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const gate = gateAdmin(session);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();
    const source = await UpvoteCampaign.findById(id).lean();
    if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const copy = await UpvoteCampaign.create({
      title: {
        de: `${source.title.de} (Kopie)`,
        en: `${source.title.en} (copy)`,
      },
      description: source.description,
      question: source.question,
      status: "draft",
      topN: source.topN,
      items: (source.items ?? []).map((item) => ({
        kind: item.kind,
        label: item.label,
        description: item.description,
        image: item.image,
        position: item.position,
        source: item.source,
        internalCardId: item.internalCardId,
        justTcgId: item.justTcgId,
        game: item.game,
        set: item.set,
        setName: item.setName,
        rarity: item.rarity,
        tcgplayerId: item.tcgplayerId,
        boxId: item.boxId,
        boxSlug: item.boxSlug,
      })),
      endsAt: null,
      closedAt: null,
      createdBy: new Types.ObjectId(gate.userId),
    });

    return NextResponse.json({ _id: copy._id.toString() }, { status: 201 });
  } catch (err) {
    console.error("[admin/upvote-campaigns/:id/duplicate]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
