import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Badge from "@/models/badge";
import { detectImageMime } from "@/lib/image-magic-bytes";
import { deleteBadgeIcon, uploadBadgeIcon } from "@/lib/gridfs-badges";

const VALID_TONES = ["neutral", "green", "gold", "lilac", "blue"] as const;
const VALID_VISIBILITY = ["public", "staff_only"] as const;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_ICON_SIZE = 2 * 1024 * 1024;

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

function serialize(badge: {
  _id: { toString(): string };
  key: string;
  slug: string;
  label: string;
  iconUrl?: string | null;
  iconImageId?: Types.ObjectId | null;
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
    iconImageId: badge.iconImageId ? badge.iconImageId.toString() : null,
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

    const form = await req.formData();
    const get = (name: string) => form.get(name);
    const text = (name: string) => {
      const v = get(name);
      return typeof v === "string" ? v : null;
    };

    const slugIn = text("slug");
    if (slugIn !== null) {
      const slug = slugIn.trim().toLowerCase();
      if (!/^[a-z0-9-]{2,80}$/.test(slug)) {
        return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
      }
      badge.slug = slug;
    }

    const labelIn = text("label");
    if (labelIn !== null) {
      const label = labelIn.trim();
      if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
      badge.label = label;
    }

    const descriptionIn = text("description");
    if (descriptionIn !== null) {
      const v = descriptionIn.trim();
      badge.description = v.length > 0 ? v : null;
    }

    const toneIn = text("tone");
    if (toneIn !== null && VALID_TONES.includes(toneIn as (typeof VALID_TONES)[number])) {
      badge.tone = toneIn as (typeof VALID_TONES)[number];
    }

    const sortIn = text("sortOrder");
    if (sortIn !== null) {
      const n = Number(sortIn);
      if (Number.isFinite(n)) badge.sortOrder = Math.trunc(n);
    }

    const visIn = text("visibility");
    if (visIn !== null && VALID_VISIBILITY.includes(visIn as (typeof VALID_VISIBILITY)[number])) {
      badge.visibility = visIn as (typeof VALID_VISIBILITY)[number];
    }

    const categoryIn = text("category");
    if (categoryIn !== null) {
      const v = categoryIn.trim();
      badge.category = v.length > 0 ? v : null;
    }

    const activeIn = text("active");
    if (activeIn !== null) {
      badge.active = activeIn !== "false";
    }

    let newIconId: ObjectId | null = null;
    const file = get("icon");
    if (file && typeof file !== "string") {
      const blob = file as File;
      if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
        return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
      }
      if (blob.size > MAX_ICON_SIZE) {
        return NextResponse.json({ error: "image_too_large" }, { status: 400 });
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const sniffed = detectImageMime(buf);
      if (!sniffed) {
        return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
      }
      const uploaded = await uploadBadgeIcon(buf, sniffed);
      newIconId = uploaded.id;
    }

    const previousIconId = badge.iconImageId;
    if (newIconId) {
      badge.iconImageId = new Types.ObjectId(newIconId.toHexString());
      badge.iconUrl = `/api/badges/images/${newIconId.toHexString()}`;
    }

    try {
      await badge.save();
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        if (newIconId) await deleteBadgeIcon(newIconId).catch(() => {});
        return NextResponse.json({ error: "slug_conflict" }, { status: 409 });
      }
      throw err;
    }

    if (newIconId && previousIconId) {
      await deleteBadgeIcon(previousIconId).catch(() => {});
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
    badge.active = false;
    await badge.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin badges DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
