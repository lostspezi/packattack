import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
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
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    await connectDB();
    const badge = await Badge.findById(id);
    if (!badge) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    // Key bleibt unveränderlich nach Erstellung. Slug, label, iconUrl,
    // description, tone, sortOrder, visibility, category, active sind frei.
    if (typeof body.slug === "string") {
      const slug = body.slug.trim().toLowerCase();
      if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
        return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
      }
      badge.slug = slug;
    }
    if (typeof body.label === "string") {
      const label = body.label.trim();
      if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
      badge.label = label;
    }
    if (body.iconUrl === null || typeof body.iconUrl === "string") {
      const v = typeof body.iconUrl === "string" ? body.iconUrl.trim() : null;
      badge.iconUrl = v && v.length > 0 ? v : null;
    }
    if (body.description === null || typeof body.description === "string") {
      const v = typeof body.description === "string" ? body.description.trim() : null;
      badge.description = v && v.length > 0 ? v : null;
    }
    if (typeof body.tone === "string" && VALID_TONES.includes(body.tone as (typeof VALID_TONES)[number])) {
      badge.tone = body.tone as (typeof VALID_TONES)[number];
    }
    if (Number.isFinite(Number(body.sortOrder))) {
      badge.sortOrder = Math.trunc(Number(body.sortOrder));
    }
    if (
      typeof body.visibility === "string" &&
      VALID_VISIBILITY.includes(body.visibility as (typeof VALID_VISIBILITY)[number])
    ) {
      badge.visibility = body.visibility as (typeof VALID_VISIBILITY)[number];
    }
    if (body.category === null || typeof body.category === "string") {
      const v = typeof body.category === "string" ? body.category.trim() : null;
      badge.category = v && v.length > 0 ? v : null;
    }
    if (typeof body.active === "boolean") {
      badge.active = body.active;
    }

    try {
      await badge.save();
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        return NextResponse.json({ error: "slug_conflict" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ badge: serialize(badge.toObject()) });
  } catch (err) {
    console.error("[admin badges PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }
    await connectDB();
    const badge = await Badge.findById(id);
    if (!badge) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // Soft-delete: bestehende UserBadges bleiben für den Audit-Trail erhalten.
    badge.active = false;
    await badge.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin badges DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
