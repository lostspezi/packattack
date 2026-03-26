import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Box from "@/models/box";
import Card from "@/models/card";
import { validateBoxWeights, hasPublishBlockingErrors, hasWarnings } from "@/lib/box-validation";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["published"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: ["draft"],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const box = await Box.findById(id).lean();
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...box,
      _id: box._id.toString(),
      cardsCount: Array.isArray(box.cards) ? box.cards.length : 0,
    });
  } catch (err) {
    console.error("[admin/boxes/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

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

  const updates = body as {
    name?: { de: string; en: string };
    description?: { de: string; en: string } | null;
    game?: string;
    priceInCoins?: number;
    cardsPerPack?: number;
    totalPacks?: number | null;
    minStock?: number;
    rarityWeights?: Array<{ rarity: string; weight?: number }>;
    status?: string;
    image?: string | null;
    force?: boolean;
  };

  if (updates.rarityWeights !== undefined) {
    if (!Array.isArray(updates.rarityWeights) || updates.rarityWeights.length === 0) {
      return NextResponse.json(
        { error: "rarityWeights must be a non-empty array" },
        { status: 400 }
      );
    }
    // Normalise: store rarity names; weights are computed from card entries
    updates.rarityWeights = updates.rarityWeights.map((rw) => ({
      rarity: rw.rarity,
      weight: rw.weight ?? 0,
    }));
  }

  try {
    await connectDB();

    const box = await Box.findById(id);
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (updates.status !== undefined && updates.status !== box.status) {
      const allowed = VALID_TRANSITIONS[box.status] ?? [];
      if (!allowed.includes(updates.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${box.status} → ${updates.status}`,
          },
          { status: 400 }
        );
      }

      // Validate weight distribution before publishing
      if (updates.status === "published") {
        const cardEntries = (box.cards ?? []) as Array<{ card: { toString(): string }; weight: number; rarity: string }>;
        const cardIds = cardEntries.map((e) => e.card.toString());
        const cardDocs = await Card.find({ _id: { $in: cardIds } }).select("name").lean();
        const cardNameMap = new Map(cardDocs.map((c) => [c._id.toString(), c.name as string]));

        const validationInput = {
          cards: cardEntries.map((e) => ({
            name: cardNameMap.get(e.card.toString()) ?? "Unknown",
            weight: e.weight,
            rarity: e.rarity,
          })),
          rarityWeights: box.rarityWeights ?? [],
          cardsPerPack: box.cardsPerPack,
        };

        const results = validateBoxWeights(validationInput);

        if (hasPublishBlockingErrors(results)) {
          const errors = results.filter((r) => r.level === "error").map((r) => r.message.en);
          return NextResponse.json(
            { error: `Cannot publish: ${errors.join("; ")}`, validationResults: results },
            { status: 400 }
          );
        }

        if (hasWarnings(results)) {
          const lang = req.headers.get("x-lang") ?? "en";
          const warnings = results.filter((r) => r.level === "warning").map((r) => lang === "de" ? r.message.de : r.message.en);
          // Allow publish but include warnings in response for the UI to show
          // Only block if `force` is not set
          const forcePublish = (body as { force?: boolean })?.force === true;
          if (!forcePublish) {
            return NextResponse.json(
              { error: "warnings", warnings, validationResults: results },
              { status: 422 }
            );
          }
        }
      }
    }

    const allowedFields = [
      "name",
      "description",
      "game",
      "priceInCoins",
      "cardsPerPack",
      "totalPacks",
      "minStock",
      "rarityWeights",
      "status",
      "image",
    ] as const;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (box as any)[field] = updates[field];
      }
    }

    await box.save();

    return NextResponse.json(box.toObject());
  } catch (err) {
    console.error("[admin/boxes/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const box = await Box.findById(id).select("status").lean();
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft boxes can be deleted" },
        { status: 400 }
      );
    }

    await Box.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/boxes/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
