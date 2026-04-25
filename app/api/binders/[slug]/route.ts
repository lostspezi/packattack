import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import BinderLike from "@/models/binder-like";
import PackPull from "@/models/pack-pull";
import { updateBinderSchema } from "@/lib/binders/validations";
import { resolveAccess } from "@/lib/binders/public-access";
import { serializeBinder } from "@/lib/binders/serialize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const viewerId =
    (session?.user as { id?: string } | undefined)?.id ?? null;

  const { slug } = await params;
  await connectDB();

  const binder = await Binder.findOne({ slug });
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const access = resolveAccess(binder, viewerId);
  if (access === "denied") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    binder: serializeBinder(binder),
    access,
  });
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

  const parsed = updateBinderSchema.safeParse(body);
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

  const updates = parsed.data;
  if (updates.name !== undefined) binder.name = updates.name;
  if (updates.description !== undefined)
    binder.description = updates.description;
  if (updates.theme !== undefined) binder.theme = updates.theme;
  if (updates.coverPackPullId !== undefined) {
    if (updates.coverPackPullId === null) {
      binder.coverPackPullId = null;
    } else {
      const cover = await PackPull.findOne({
        _id: updates.coverPackPullId,
        userId: binder.userId,
      })
        .select("_id")
        .lean();
      if (!cover) {
        return NextResponse.json(
          { error: "cover_not_owned" },
          { status: 400 },
        );
      }
      binder.coverPackPullId = cover._id;
    }
  }
  if (updates.isPublic !== undefined) {
    if (updates.isPublic && !binder.isPublic) {
      binder.publishedAt = new Date();
    }
    binder.isPublic = updates.isPublic;
  }

  await binder.save();

  return NextResponse.json({ binder: serializeBinder(binder) });
}

export async function DELETE(
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

  await PackPull.updateMany(
    { binderId: binder._id, userId: binder.userId },
    { $set: { binderId: null } },
  );
  await BinderLike.deleteMany({ binderId: binder._id });
  await binder.deleteOne();

  return NextResponse.json({ success: true });
}
