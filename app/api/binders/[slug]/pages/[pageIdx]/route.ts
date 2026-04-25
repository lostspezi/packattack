import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import { updatePageSchema } from "@/lib/binders/validations";
import { serializeBinder } from "@/lib/binders/serialize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; pageIdx: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug, pageIdx: pageIdxStr } = await params;
  const pageIdx = Number.parseInt(pageIdxStr, 10);
  if (!Number.isInteger(pageIdx) || pageIdx < 0) {
    return NextResponse.json({ error: "invalid_page" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updatePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();
  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (pageIdx >= binder.pages.length) {
    return NextResponse.json({ error: "page_out_of_range" }, { status: 404 });
  }

  const page = binder.pages[pageIdx];
  if (parsed.data.title !== undefined) page.title = parsed.data.title;
  if (parsed.data.backgroundId !== undefined)
    page.backgroundId = parsed.data.backgroundId;
  binder.markModified("pages");
  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; pageIdx: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug, pageIdx: pageIdxStr } = await params;
  const pageIdx = Number.parseInt(pageIdxStr, 10);
  if (!Number.isInteger(pageIdx) || pageIdx < 0) {
    return NextResponse.json({ error: "invalid_page" }, { status: 400 });
  }

  await connectDB();
  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (binder.pages.length <= 1) {
    return NextResponse.json({ error: "cannot_remove_last_page" }, { status: 409 });
  }
  if (pageIdx >= binder.pages.length) {
    return NextResponse.json({ error: "page_out_of_range" }, { status: 404 });
  }

  const page = binder.pages[pageIdx];
  const occupied = page.slots.some((s) => s.packPullId);
  if (occupied) {
    return NextResponse.json({ error: "page_not_empty" }, { status: 409 });
  }

  binder.pages.splice(pageIdx, 1);
  binder.markModified("pages");
  await binder.save();

  return NextResponse.json({ success: true });
}
