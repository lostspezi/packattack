import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder, { type IBinderPage } from "@/models/binder";
import PackPull from "@/models/pack-pull";
import { slotOpSchema, type SlotOpInput } from "@/lib/binders/validations";
import {
  placeCard,
  removeCard,
  swapSlots,
  SlotOpError,
  type PlainPage,
} from "@/lib/binders/slot-ops";
import { autoGrowIfNeeded } from "@/lib/binders/auto-grow";
import { serializeBinder } from "@/lib/binders/serialize";

function toPlainPages(pages: IBinderPage[]): PlainPage[] {
  return pages.map((p) => ({
    title: p.title,
    backgroundId: p.backgroundId,
    slots: p.slots.map((s) => ({
      position: s.position,
      packPullId: s.packPullId ? s.packPullId.toString() : null,
      expectedCardId: s.expectedCardId ? s.expectedCardId.toString() : null,
      note: s.note,
    })),
  }));
}

function fromPlainPages(pages: PlainPage[]): IBinderPage[] {
  return pages.map((p) => ({
    title: p.title,
    backgroundId: p.backgroundId,
    slots: p.slots.map((s) => ({
      position: s.position,
      packPullId: s.packPullId
        ? new Types.ObjectId(s.packPullId)
        : null,
      expectedCardId: s.expectedCardId
        ? new Types.ObjectId(s.expectedCardId)
        : null,
      note: s.note,
    })),
  })) as IBinderPage[];
}

interface PlanResult {
  nextPages: PlainPage[];
  cardsToBind: string[];
  cardsToUnbind: string[];
}

function planSlotOp(pages: PlainPage[], op: SlotOpInput): PlanResult {
  if (op.op === "place" || op.op === "move") {
    const result = placeCard({
      pages,
      coord: { pageIndex: op.pageIndex, slotPosition: op.slotPosition },
      packPullId: op.packPullId,
      expectedCurrent:
        op.expectedCurrent === undefined ? undefined : op.expectedCurrent,
    });
    const cardsToBind: string[] = [];
    const cardsToUnbind: string[] = [];
    if (result.displacedPackPullId === null) {
      cardsToBind.push(op.packPullId);
    } else if (result.displacedPackPullId === op.packPullId) {
      // idempotent on own slot — no PackPull mutations
    } else {
      cardsToBind.push(op.packPullId);
      cardsToUnbind.push(result.displacedPackPullId);
    }
    return { nextPages: result.pages, cardsToBind, cardsToUnbind };
  }

  if (op.op === "remove") {
    const result = removeCard({
      pages,
      coord: { pageIndex: op.pageIndex, slotPosition: op.slotPosition },
      expectedCurrent: op.expectedCurrent,
    });
    return {
      nextPages: result.pages,
      cardsToBind: [],
      cardsToUnbind: [result.removedPackPullId],
    };
  }

  // swap — both packPullIds (if any) stay in this binder, but defensively
  // re-bind them so any drift (e.g. a slot referencing a packPull whose
  // binderId got nulled by a prior failed bind) is corrected on the next
  // user action.
  const nextPages = swapSlots({ pages, from: op.from, to: op.to });
  const fromSlot = nextPages[op.from.pageIndex]?.slots.find(
    (s) => s.position === op.from.slotPosition,
  );
  const toSlot = nextPages[op.to.pageIndex]?.slots.find(
    (s) => s.position === op.to.slotPosition,
  );
  const cardsToBind: string[] = [];
  if (fromSlot?.packPullId) cardsToBind.push(fromSlot.packPullId);
  if (toSlot?.packPullId) cardsToBind.push(toSlot.packPullId);
  return { nextPages, cardsToBind, cardsToUnbind: [] };
}

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = slotOpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const op = parsed.data;

  await connectDB();
  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (binder.userId.toString() !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (op.op === "place" || op.op === "move") {
    const pull = await PackPull.findOne({
      _id: new Types.ObjectId(op.packPullId),
    })
      .select("userId status binderId")
      .lean();
    if (!pull) {
      return NextResponse.json(
        { error: "pack_pull_not_found" },
        { status: 404 },
      );
    }
    if (pull.userId.toString() !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (pull.status !== "claimed") {
      return NextResponse.json(
        { error: "pack_pull_not_claimed" },
        { status: 409 },
      );
    }
    if (
      pull.binderId &&
      pull.binderId.toString() !== binder._id.toString()
    ) {
      return NextResponse.json(
        { error: "pack_pull_in_other_binder" },
        { status: 409 },
      );
    }
  }

  let plan: PlanResult;
  try {
    plan = planSlotOp(toPlainPages(binder.pages), op);
  } catch (err) {
    if (err instanceof SlotOpError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 409 },
      );
    }
    throw err;
  }

  let nextPages = plan.nextPages;
  if (binder.type === "free") {
    nextPages = autoGrowIfNeeded(nextPages);
  }

  const binderObjId = binder._id;
  if (plan.cardsToUnbind.length > 0) {
    await PackPull.updateMany(
      {
        _id: { $in: plan.cardsToUnbind.map((id) => new Types.ObjectId(id)) },
        binderId: binderObjId,
      },
      { $set: { binderId: null } },
    );
  }
  if (plan.cardsToBind.length > 0) {
    const bindResult = await PackPull.updateMany(
      {
        _id: { $in: plan.cardsToBind.map((id) => new Types.ObjectId(id)) },
        userId: binder.userId,
        status: "claimed",
        $or: [{ binderId: null }, { binderId: binderObjId }],
      },
      { $set: { binderId: binderObjId } },
    );
    if (bindResult.matchedCount !== plan.cardsToBind.length) {
      // Roll back unbinds so the previous state holds
      if (plan.cardsToUnbind.length > 0) {
        await PackPull.updateMany(
          {
            _id: {
              $in: plan.cardsToUnbind.map((id) => new Types.ObjectId(id)),
            },
            userId: binder.userId,
            binderId: null,
          },
          { $set: { binderId: binderObjId } },
        );
      }
      return NextResponse.json(
        { error: "pack_pull_concurrent_change" },
        { status: 409 },
      );
    }
  }

  binder.pages = fromPlainPages(nextPages);
  binder.markModified("pages");
  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}
