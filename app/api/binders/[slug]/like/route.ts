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
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ ok: true, alreadyLiked: true });
    }
    throw err;
  }

  // Recompute the counter from the like collection so a crash between the
  // create and the increment can't permanently desync the cached count.
  const likeCount = await BinderLike.countDocuments({ binderId: binder._id });
  await Binder.updateOne({ _id: binder._id }, { $set: { likeCount } });

  return NextResponse.json({ ok: true, likeCount });
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

  await BinderLike.findOneAndDelete({
    binderId: binder._id,
    userId: new Types.ObjectId(userId),
  });

  const likeCount = await BinderLike.countDocuments({ binderId: binder._id });
  await Binder.updateOne({ _id: binder._id }, { $set: { likeCount } });

  return NextResponse.json({ ok: true, likeCount });
}
