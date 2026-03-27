import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Language from "@/models/language";
import Translation from "@/models/translation";
import { invalidateLanguageCache, invalidateTranslationCache } from "@/lib/i18n";

function isAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const languages = await Language.find().sort({ code: 1 }).lean();

    return NextResponse.json({
      languages: languages.map((l) => ({
        _id: l._id.toString(),
        code: l.code,
        name: l.name,
        isDefault: l.isDefault,
        isActive: l.isActive,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/languages GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { code, name } = body;

  if (!code || !name) {
    return NextResponse.json(
      { error: "code and name are required" },
      { status: 400 }
    );
  }

  const normalizedCode = code.toLowerCase().trim();
  if (!/^[a-z]{2,5}$/.test(normalizedCode)) {
    return NextResponse.json(
      { error: "code must be 2-5 lowercase letters" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // Check for duplicates
    const existing = await Language.findOne({ code: normalizedCode });
    if (existing) {
      return NextResponse.json(
        { error: "Language code already exists" },
        { status: 409 }
      );
    }

    const lang = await Language.create({
      code: normalizedCode,
      name: name.trim(),
      isDefault: false,
      isActive: true,
    });

    // Add empty values for this language to all existing translations
    await Translation.updateMany(
      {},
      { $set: { [`values.${normalizedCode}`]: "" } }
    );

    // Invalidate caches
    await invalidateLanguageCache();
    const namespaces = await Translation.distinct("namespace");
    await Promise.all(namespaces.map((ns) => invalidateTranslationCache(ns)));

    return NextResponse.json({
      _id: lang._id.toString(),
      code: lang.code,
      name: lang.name,
      isDefault: lang.isDefault,
      isActive: lang.isActive,
    });
  } catch (err) {
    console.error("[admin/languages POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string; isActive?: boolean; isDefault?: boolean; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    await connectDB();

    const lang = await Language.findOne({ code });
    if (!lang) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    // Cannot deactivate the default language
    if (body.isActive === false && lang.isDefault) {
      return NextResponse.json(
        { error: "Cannot deactivate the default language" },
        { status: 400 }
      );
    }

    // Set as default
    if (body.isDefault === true && !lang.isDefault) {
      await Language.updateMany({ isDefault: true }, { isDefault: false });
      lang.isDefault = true;
      lang.isActive = true; // Default must be active
    }

    if (body.isActive !== undefined) lang.isActive = body.isActive;
    if (body.name !== undefined) lang.name = body.name.trim();

    await lang.save();
    await invalidateLanguageCache();

    return NextResponse.json({
      _id: lang._id.toString(),
      code: lang.code,
      name: lang.name,
      isDefault: lang.isDefault,
      isActive: lang.isActive,
    });
  } catch (err) {
    console.error("[admin/languages PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    await connectDB();

    const lang = await Language.findOne({ code });
    if (!lang) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    if (lang.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default language" },
        { status: 400 }
      );
    }

    // Remove language values from all translations
    await Translation.updateMany(
      {},
      { $unset: { [`values.${code}`]: "" } }
    );

    await Language.deleteOne({ code });
    await invalidateLanguageCache();

    // Invalidate all translation caches
    const namespaces = await Translation.distinct("namespace");
    await Promise.all(namespaces.map((ns) => invalidateTranslationCache(ns)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/languages DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
