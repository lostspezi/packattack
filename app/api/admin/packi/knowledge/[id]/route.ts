import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackiKnowledge from "@/models/packi-knowledge";
import { PackiKnowledgePatchSchema } from "@/lib/packi/knowledge-validation";

export const dynamic = "force-dynamic";

function isAdmin(role?: string): boolean {
  return role === "admin" || role === "super_admin";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PackiKnowledgePatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const userId = session.user.id;
    const updaterId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : null;

    const doc = await PackiKnowledge.findByIdAndUpdate(
      id,
      { ...parsed.data, updatedBy: updaterId },
      { new: true },
    ).lean();
    if (!doc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      id: doc._id.toString(),
      topic: doc.topic,
      correction: doc.correction,
      priority: doc.priority,
      active: doc.active,
      language: doc.language,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error("[admin/packi/knowledge PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectDB();
    const deleted = await PackiKnowledge.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/packi/knowledge DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
