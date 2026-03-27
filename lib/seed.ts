import connectDB from "./db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";
import Translation from "@/models/translation";
import Language from "@/models/language";
import EmailTemplate from "@/models/email-template";
import bcrypt from "bcryptjs";
import { translationSeedData } from "@/seed/translations";
import { emailTemplateSeedData } from "@/seed/email-templates";
import { invalidateTranslationCache, invalidateLanguageCache } from "@/lib/i18n";

async function runInitialSeed() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log(`[seed] Skipping initial seed — ${userCount} user(s) already exist.`);
    return;
  }

  console.log("[seed] First start detected — creating admin user and platform settings...");

  const hashedPassword = await bcrypt.hash("admin123", 12);

  // Use findOneAndUpdate with upsert to avoid duplicate key errors from parallel runs
  const adminUser = await User.findOneAndUpdate(
    { email: "admin@packattack.gg" },
    {
      $setOnInsert: {
        name: "Super Admin",
        username: "admin",
        email: "admin@packattack.gg",
        emailVerified: new Date(),
        password: hashedPassword,
        role: "super_admin",
        dateOfBirth: new Date("1990-01-01"),
        preferences: { language: "de", theme: "dark", notifications: { email: true, browser: true } },
        publicProfile: false,
        onboardingCompleted: true,
        consents: {
          tos: { accepted: true, version: "1.0", acceptedAt: new Date() },
          privacy: { accepted: true, version: "1.0", acceptedAt: new Date() },
          ageVerification: { accepted: true, acceptedAt: new Date() },
        },
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (adminUser.createdAt && Date.now() - adminUser.createdAt.getTime() < 5000) {
    console.log("[seed]   ✓ Super Admin user created (admin@packattack.gg)");
  } else {
    console.log("[seed]   ✓ Super Admin user already exists");
  }

  const settingsResult = await PlatformSettings.updateOne(
    {},
    {
      $setOnInsert: {
        tosVersion: "1.0",
        privacyVersion: "1.0",
      },
    },
    { upsert: true }
  );
  if (settingsResult.upsertedCount > 0) {
    console.log("[seed]   ✓ Platform settings created (ToS v1.0, Privacy v1.0)");
  } else {
    console.log("[seed]   ✓ Platform settings already exist");
  }
}

async function syncLanguages() {
  const result = await Language.updateOne(
    { code: "de" },
    {
      $setOnInsert: {
        code: "de",
        name: "Deutsch",
        isDefault: true,
        isActive: true,
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    try { await invalidateLanguageCache(); } catch { /* Redis unavailable during build */ }
    console.log("[seed]   ✓ Default language created (de — Deutsch)");
  } else {
    console.log("[seed]   ✓ Default language already exists");
  }

  // Migration: remove English values from existing translations if English is not an active language
  const englishLang = await Language.findOne({ code: "en", isActive: true });
  if (!englishLang) {
    const migrated = await Translation.updateMany(
      { "values.en": { $exists: true } },
      { $unset: { "values.en": "" } }
    );
    if (migrated.modifiedCount > 0) {
      console.log(`[seed]   ✓ Migrated ${migrated.modifiedCount} translation(s): removed English values`);
    }
  }
}

async function syncTranslations() {
  const total = translationSeedData.length;
  const existingCount = await Translation.countDocuments();
  let inserted = 0;

  for (const item of translationSeedData) {
    const result = await Translation.updateOne(
      { namespace: item.namespace, key: item.key },
      { $setOnInsert: item },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted++;
  }

  if (inserted > 0) {
    // Invalidate Redis cache for all affected namespaces (skip if Redis unavailable, e.g. during build)
    try {
      const namespaces = [...new Set(translationSeedData.map((item) => item.namespace))];
      await Promise.all(namespaces.map((ns) => invalidateTranslationCache(ns)));
      console.log(`[seed]   ✓ Translations: ${inserted} new key(s) inserted (${existingCount} already existed, ${total} total in seed) — cache invalidated`);
    } catch {
      console.log(`[seed]   ✓ Translations: ${inserted} new key(s) inserted (${existingCount} already existed, ${total} total in seed) — cache skip (Redis unavailable)`);
    }
  } else {
    console.log(`[seed]   ✓ Translations: all ${total} key(s) up to date`);
  }
}

async function syncEmailTemplates() {
  const total = emailTemplateSeedData.length;
  const existingCount = await EmailTemplate.countDocuments();
  let inserted = 0;

  for (const item of emailTemplateSeedData) {
    const result = await EmailTemplate.updateOne(
      { slug: item.slug },
      { $setOnInsert: item },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted++;
  }

  if (inserted > 0) {
    console.log(`[seed]   ✓ Email templates: ${inserted} new template(s) inserted (${existingCount} already existed, ${total} total in seed)`);
  } else {
    console.log(`[seed]   ✓ Email templates: all ${total} template(s) up to date`);
  }
}

async function migrateBoxSlugs() {
  const Box = (await import("@/models/box")).default;
  const boxes = await Box.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] });
  if (boxes.length === 0) return;

  for (const box of boxes) {
    box.slug = undefined as unknown as string; // Force pre-save hook to generate
    await box.save();
  }
  console.log(`[seed]   ✓ Generated slugs for ${boxes.length} existing box(es)`);
}

export async function runSeed() {
  const start = performance.now();
  console.log("[seed] Starting seed process...");

  await connectDB();
  console.log("[seed] Database connected.");

  await runInitialSeed();
  await syncLanguages();
  await syncTranslations();
  await syncEmailTemplates();
  await migrateBoxSlugs();

  const duration = (performance.now() - start).toFixed(0);
  console.log(`[seed] Seed complete in ${duration}ms.`);
}
