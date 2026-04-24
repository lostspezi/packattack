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
  createdAt?: Date;
  updatedAt?: Date;
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
    const form = await req.formData();
    const get = (name: string) => {
      const v = form.get(name);
      return typeof v === "string" ? v : "";
    };

    const key = get("key").trim();
    const slug = get("slug").trim().toLowerCase();
    const label = get("label").trim();
    const description = get("description").trim() || null;
    const toneRaw = get("tone");
    const tone = VALID_TONES.includes(toneRaw as (typeof VALID_TONES)[number])
      ? (toneRaw as (typeof VALID_TONES)[number])
      : "neutral";
    const visibilityRaw = get("visibility");
    const visibility = VALID_VISIBILITY.includes(
      visibilityRaw as (typeof VALID_VISIBILITY)[number],
    )
      ? (visibilityRaw as (typeof VALID_VISIBILITY)[number])
      : "public";
    const category = get("category").trim() || null;
    const sortOrderNum = Number(get("sortOrder") || "0");
    const active = get("active") !== "false";

    if (!key || !/^[a-z0-9_]{2,64}$/.test(key)) {
      return NextResponse.json({ error: "key_invalid" }, { status: 400 });
    }
    if (!slug || !/^[a-z0-9-]{2,80}$/.test(slug)) {
      return NextResponse.json({ error: "slug_invalid" }, { status: 400 });
    }
    if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });

    let uploadedIconId: ObjectId | null = null;
    const file = form.get("icon");
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
      const result = await uploadBadgeIcon(buf, sniffed);
      uploadedIconId = result.id;
    }

    try {
      const created = await Badge.create({
        key,
        slug,
        label,
        iconUrl: uploadedIconId
          ? `/api/badges/images/${uploadedIconId.toHexString()}`
          : null,
        iconImageId: uploadedIconId ? new Types.ObjectId(uploadedIconId.toHexString()) : null,
        description,
        tone,
        active,
        sortOrder: Number.isFinite(sortOrderNum) ? Math.trunc(sortOrderNum) : 0,
        visibility,
        category,
      });
      return NextResponse.json({ badge: serialize(created.toObject()) }, { status: 201 });
    } catch (createErr) {
      if (uploadedIconId) {
        await deleteBadgeIcon(uploadedIconId).catch(() => {});
      }
      if ((createErr as { code?: number })?.code === 11000) {
        return NextResponse.json({ error: "key_or_slug_conflict" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (err) {
    console.error("[admin badges POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
