import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import Achievement, {
  type AchievementCategory,
  type AchievementTrigger,
  type AchievementReward,
} from "@/models/achievement";
import Translation from "@/models/translation";
import { detectImageMime } from "@/lib/image-magic-bytes";
import {
  deleteAchievementIcon,
  uploadAchievementIcon,
} from "@/lib/gridfs-achievements";
import {
  parseAchievementPayload,
  sanitizeAchievementPayload,
  serializeAchievement,
  upsertAchievementTranslations,
  ALLOWED_IMAGE_TYPES,
  MAX_ICON_SIZE,
} from "@/lib/admin/achievement-payload";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("role").lean<{ role?: string } | null>();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const activeParam = searchParams.get("active");

    const filter: Record<string, unknown> = {};
    const validCategories = ["level", "progression", "battle", "economy", "social", "event"];
    if (category && validCategories.includes(category)) {
      filter.category = category;
    }
    if (activeParam === "true") filter.active = true;
    else if (activeParam === "false") filter.active = false;

    const achievements = await Achievement.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      achievements: achievements.map(serializeAchievement),
    });
  } catch (err) {
    console.error("[admin/achievements GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("role").lean<{ role?: string } | null>();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const raw = parseAchievementPayload(form);
    const payload = sanitizeAchievementPayload(raw);
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

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
      const result = await uploadAchievementIcon(buf, sniffed);
      uploadedIconId = result.id;
    }

    try {
      const created = await Achievement.create({
        key: payload.data.key,
        titleKey: `achievements.${payload.data.key}.title`,
        descriptionKey: `achievements.${payload.data.key}.description`,
        iconImageId: uploadedIconId
          ? new Types.ObjectId(uploadedIconId.toHexString())
          : null,
        category: payload.data.category as AchievementCategory,
        hidden: payload.data.hidden,
        active: payload.data.active,
        sortOrder: payload.data.sortOrder,
        trigger: payload.data.trigger as AchievementTrigger,
        rewards: payload.data.rewards as AchievementReward[],
      });

      await upsertAchievementTranslations(
        Translation,
        payload.data.key,
        payload.data.titles,
        payload.data.descriptions,
        session.user.id,
      );

      return NextResponse.json(
        { achievement: serializeAchievement(created.toObject()) },
        { status: 201 },
      );
    } catch (createErr) {
      if (uploadedIconId) {
        await deleteAchievementIcon(uploadedIconId).catch(() => {
          /* best effort */
        });
      }
      if ((createErr as { code?: number })?.code === 11000) {
        return NextResponse.json({ error: "key_conflict" }, { status: 409 });
      }
      throw createErr;
    }
  } catch (err) {
    console.error("[admin/achievements POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
