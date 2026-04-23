import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import PackiKnowledge from "@/models/packi-knowledge";
import { PackiKnowledgeInputSchema } from "@/lib/packi/knowledge-validation";

export const dynamic = "force-dynamic";

function isAdmin(role?: string): boolean {
  return role === "admin" || role === "super_admin";
}

function serialize(doc: {
  _id: { toString(): string };
  topic: string;
  correction: string;
  priority: number;
  active: boolean;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { toString(): string } | null;
  updatedBy?: { toString(): string } | null;
}) {
  return {
    id: doc._id.toString(),
    topic: doc.topic,
    correction: doc.correction,
    priority: doc.priority,
    active: doc.active,
    language: doc.language,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy?.toString() ?? null,
    updatedBy: doc.updatedBy?.toString() ?? null,
  };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const docs = await PackiKnowledge.find()
      .sort({ active: -1, priority: -1, updatedAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      entries: docs.map((d) => serialize(d)),
    });
  } catch (err) {
    console.error("[admin/packi/knowledge GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PackiKnowledgeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const userId = session.user.id;
    const authorId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : null;

    const doc = await PackiKnowledge.create({
      ...parsed.data,
      createdBy: authorId,
      updatedBy: authorId,
    });
    return NextResponse.json(serialize(doc.toObject()), { status: 201 });
  } catch (err) {
    console.error("[admin/packi/knowledge POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
