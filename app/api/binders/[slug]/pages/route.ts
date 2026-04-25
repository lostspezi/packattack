import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import { MAX_PAGES } from "@/lib/binders/auto-grow";
import { makeEmptyPage } from "@/lib/binders/slot-ops";
import { serializeBinder } from "@/lib/binders/serialize";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  await connectDB();

  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (binder.pages.length >= MAX_PAGES) {
    return NextResponse.json({ error: "max_pages_reached" }, { status: 409 });
  }

  const fresh = makeEmptyPage();
  binder.pages.push({
    title: null,
    backgroundId: null,
    slots: fresh.slots.map((s) => ({
      position: s.position,
      packPullId: null,
      expectedCardId: null,
      note: null,
    })),
  } as (typeof binder.pages)[number]);
  binder.markModified("pages");
  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}
