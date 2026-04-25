import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import { updateSlotNoteSchema } from "@/lib/binders/validations";
import { serializeBinder } from "@/lib/binders/serialize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const url = new URL(req.url);
  const pageIdx = Number.parseInt(url.searchParams.get("pageIdx") ?? "", 10);
  const slotPosition = Number.parseInt(
    url.searchParams.get("slot") ?? "",
    10,
  );
  if (
    !Number.isInteger(pageIdx) ||
    pageIdx < 0 ||
    !Number.isInteger(slotPosition) ||
    slotPosition < 0 ||
    slotPosition > 8
  ) {
    return NextResponse.json({ error: "invalid_coord" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = updateSlotNoteSchema.safeParse(body);
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
  const slot = page.slots.find((s) => s.position === slotPosition);
  if (!slot) {
    return NextResponse.json({ error: "slot_not_found" }, { status: 404 });
  }
  if (!slot.packPullId) {
    return NextResponse.json({ error: "slot_empty" }, { status: 409 });
  }
  slot.note = parsed.data.note;
  binder.markModified("pages");
  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}
