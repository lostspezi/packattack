import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Binder from "@/models/binder";
import BinderLike from "@/models/binder-like";

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

  const binder = await Binder.findOne({ slug }).select("_id isPublic");
  if (!binder || !binder.isPublic) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await BinderLike.create({
      binderId: binder._id,
      userId: new Types.ObjectId(userId),
    });
    await Binder.updateOne(
      { _id: binder._id },
      { $inc: { likeCount: 1 } },
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ ok: true, alreadyLiked: true });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
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

  const binder = await Binder.findOne({ slug }).select("_id");
  if (!binder) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const removed = await BinderLike.findOneAndDelete({
    binderId: binder._id,
    userId: new Types.ObjectId(userId),
  });
  if (removed) {
    await Binder.updateOne(
      { _id: binder._id, likeCount: { $gt: 0 } },
      { $inc: { likeCount: -1 } },
    );
  }

  return NextResponse.json({ ok: true });
}
