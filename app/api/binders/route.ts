import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import { createBinderSchema } from "@/lib/binders/validations";
import { buildTemplatePages } from "@/lib/binders/template";
import { makeEmptyPage } from "@/lib/binders/slot-ops";
import { serializeBinderSummary } from "@/lib/binders/serialize";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();
  const binders = await Binder.find({ userId: new Types.ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .limit(200);

  return NextResponse.json({
    binders: binders.map(serializeBinderSummary),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createBinderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  await connectDB();

  let pages;
  let setTemplate: { game: string; set: string } | null = null;
  if (data.type === "set-template" && data.setTemplate) {
    const built = await buildTemplatePages(
      data.setTemplate.game,
      data.setTemplate.set,
    );
    if (built.expectedCardIds.length === 0) {
      return NextResponse.json(
        { error: "set_has_no_cards" },
        { status: 400 },
      );
    }
    pages = built.pages.map((p) => ({
      title: p.title,
      backgroundId: p.backgroundId,
      slots: p.slots.map((s) => ({
        position: s.position,
        packPullId: null,
        expectedCardId: s.expectedCardId
          ? new Types.ObjectId(s.expectedCardId)
          : null,
        note: null,
      })),
    }));
    setTemplate = data.setTemplate;
  } else {
    pages = [
      {
        title: null,
        backgroundId: null,
        slots: makeEmptyPage().slots.map((s) => ({
          position: s.position,
          packPullId: null,
          expectedCardId: null,
          note: null,
        })),
      },
    ];
  }

  const binder = await Binder.create({
    userId: new Types.ObjectId(userId),
    name: data.name,
    description: data.description ?? "",
    type: data.type,
    setTemplate,
    theme: data.theme ?? "classic",
    pages,
  });

  return NextResponse.json(
    { binder: serializeBinderSummary(binder) },
    { status: 201 },
  );
}
