import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import Achievement from "@/models/achievement";
import UserAchievement from "@/models/user-achievement";
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
import { invalidateUserEffects } from "@/lib/achievements/effects";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

async function requireAdmin(sessionUserId?: string) {
  if (!sessionUserId) return null;
  await connectDB();
  const user = await User.findById(sessionUserId)
    .select("role")
    .lean<{ role?: string } | null>();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const adminUser = await requireAdmin(session?.user?.id);
  if (!adminUser) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }
    const achievement = await Achievement.findById(id).lean();
    if (!achievement) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const titleKey = `${achievement.key}.title`;
    const descriptionKey = `${achievement.key}.description`;
    const translations = await Translation.find({
      namespace: "achievements",
      key: { $in: [titleKey, descriptionKey] },
    }).lean();
    const titles: Record<string, string> = {};
    const descriptions: Record<string, string> = {};
    for (const t of translations) {
      const target = t.key === titleKey ? titles : descriptions;
      const v = t.values instanceof Map ? Object.fromEntries(t.values) : (t.values ?? {});
      for (const [lang, value] of Object.entries(v as Record<string, string>)) {
        target[lang] = value;
      }
    }
    return NextResponse.json({
      achievement: serializeAchievement(achievement),
      titles,
      descriptions,
    });
  } catch (err) {
    console.error("[admin/achievements/[id] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const adminUser = await requireAdmin(session?.user?.id);
  if (!adminUser) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const existing = await Achievement.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const form = await req.formData();
    const raw = parseAchievementPayload(form);
    // Key is immutable after creation — ignore incoming key.
    raw.key = existing.key;
    const payload = sanitizeAchievementPayload(raw, { requireKey: false });
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    let newIconId: ObjectId | null = null;
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
      const uploaded = await uploadAchievementIcon(buf, sniffed);
      newIconId = uploaded.id;
    }

    const previousIconId = existing.iconImageId;

    existing.set({
      category: payload.data.category,
      hidden: payload.data.hidden,
      active: payload.data.active,
      sortOrder: payload.data.sortOrder,
      trigger: payload.data.trigger,
      rewards: payload.data.rewards,
    });
    existing.markModified("trigger");
    existing.markModified("rewards");
    if (newIconId) {
      existing.iconImageId = new Types.ObjectId(newIconId.toHexString());
    }
    await existing.save();

    if (newIconId && previousIconId) {
      // Wichtig: erst neue ID speichern, dann alten File löschen. Fehlschlag
      // beim Delete ist kosmetisch und darf den Admin nicht blockieren.
      await deleteAchievementIcon(previousIconId).catch(() => {});
    }

    await upsertAchievementTranslations(
      Translation,
      existing.key,
      payload.data.titles,
      payload.data.descriptions,
      session?.user?.id ?? null,
    );

    // Rewards/Effects können sich geändert haben → Cache aller User invalidieren,
    // die das Achievement besitzen.
    const holders = await UserAchievement.find({ achievementId: existing._id, completed: true })
      .select("userId")
      .lean<Array<{ userId: Types.ObjectId }>>();
    await Promise.all(holders.map((h) => invalidateUserEffects(h.userId)));

    return NextResponse.json({ achievement: serializeAchievement(existing.toObject()) });
  } catch (err) {
    console.error("[admin/achievements/[id] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const adminUser = await requireAdmin(session?.user?.id);
  if (!adminUser) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }
    const achievement = await Achievement.findById(id);
    if (!achievement) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const iconId = achievement.iconImageId;
    const holders = await UserAchievement.find({ achievementId: achievement._id, completed: true })
      .select("userId")
      .lean<Array<{ userId: Types.ObjectId }>>();

    // Soft-delete: Achievement auf active=false, UserAchievements bleiben
    // bestehen (Audit-Trail). active + iconImageId in einem Save, damit es
    // kein Zeitfenster mit stale-iconId gibt. Das Löschen der GridFS-Datei
    // ist best-effort und läuft nach dem Save.
    achievement.active = false;
    achievement.iconImageId = null;
    await achievement.save();
    if (iconId) {
      await deleteAchievementIcon(iconId).catch(() => {});
    }

    await Promise.all(holders.map((h) => invalidateUserEffects(h.userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/achievements/[id] DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
