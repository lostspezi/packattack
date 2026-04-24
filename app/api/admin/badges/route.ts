import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Badge from "@/models/badge";

const VALID_TONES = ["neutral", "green", "gold", "lilac", "blue"] as const;
const VALID_VISIBILITY = ["public", "staff_only"] as const;

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

function serialize(badge: {
  _id: { toString(): string };
  key: string;
  slug: string;
  label: string;
  iconUrl?: string | null;
  description?: string | null;
  tone?: string;
  active?: boolean;
  sortOrder?: number;
  visibility?: string;
  category?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    _id: badge._id.toString(),
    key: badge.key,
    slug: badge.slug,
    label: badge.label,
    iconUrl: badge.iconUrl ?? null,
    description: badge.description ?? null,
    tone: badge.tone ?? "neutral",
    active: badge.active !== false,
    sortOrder: badge.sortOrder ?? 0,
    visibility: badge.visibility ?? "public",
    category: badge.category ?? null,
    createdAt: badge.createdAt,
    updatedAt: badge.updatedAt,
  };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    // Admin-Liste enthält auch inaktive Badges, damit der Admin sie wieder
    // einschalten kann (anders als die User-facing getActiveBadgeDefinitions).
    const badges = await Badge.find({}).sort({ sortOrder: 1, label: 1 }).lean();
    return NextResponse.json({ badges: badges.map(serialize) });
  } catch (error) {
    console.error("[admin badges GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;
    const key = String(body.key ?? "").trim();
    const slug = String(body.slug ?? "").trim().toLowerCase();
    const label = String(body.label ?? "").trim();
    const iconUrl = typeof body.iconUrl === "string" && body.iconUrl.trim() ? body.iconUrl.trim() : null;
    const description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    const tone = VALID_TONES.includes(body.tone as (typeof VALID_TONES)[number])
      ? (body.tone as (typeof VALID_TONES)[number])
      : "neutral";
    const visibility = VALID_VISIBILITY.includes(
      body.visibility as (typeof VALID_VISIBILITY)[number],
    )
      ? (body.visibility as (typeof VALID_VISIBILITY)[number])
      : "public";
    const category =
      typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
    const sortOrder = Number(body.sortOrder ?? 0);
    const active = body.active !== false;

    if (!key || !/^[a-z0-9_]{2,64}$/.test(key)) {
      return NextResponse.json({ error: "key_invalid" }, { status: 400 });
    }
    if (!slug || !/^[a-z0-9-]{2,80}$/.test(slug)) {
      return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
    }
    if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });

    const created = await Badge.create({
      key,
      slug,
      label,
      iconUrl,
      description,
      tone,
      active,
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      visibility,
      category,
    });

    return NextResponse.json({ badge: serialize(created.toObject()) }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "key_or_slug_conflict" }, { status: 409 });
    }
    console.error("[admin badges POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
