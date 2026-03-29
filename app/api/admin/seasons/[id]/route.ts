import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Season from "@/models/season";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const validStatuses = ["upcoming", "active", "ended"];
  if (b.status && !validStatuses.includes(b.status as string)) {
    return NextResponse.json(
      { error: "status must be one of: upcoming, active, ended" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const season = await Season.findById(id);
    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (b.name) season.name = b.name as { de: string; en: string };
    if (b.number !== undefined) season.number = b.number as number;
    if (b.startsAt) season.startsAt = new Date(b.startsAt as string);
    if (b.endsAt) season.endsAt = new Date(b.endsAt as string);
    if (b.status) season.status = b.status as "upcoming" | "active" | "ended";
    if (b.rewards !== undefined) season.rewards = b.rewards as typeof season.rewards;

    await season.save();

    return NextResponse.json({
      _id: season._id.toString(),
      name: season.name,
      number: season.number,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      status: season.status,
      rewards: season.rewards,
    });
  } catch (err) {
    console.error("[admin/seasons PUT]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const season = await Season.findByIdAndDelete(id);
    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/seasons DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
