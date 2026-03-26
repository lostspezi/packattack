import connectDB from "./db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";
import Translation from "@/models/translation";
import EmailTemplate from "@/models/email-template";
import bcrypt from "bcryptjs";
import { translationSeedData } from "@/seed/translations";
import { emailTemplateSeedData } from "@/seed/email-templates";

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
        preferences: { language: "en", theme: "dark", notifications: { email: true, browser: true } },
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
    console.log(`[seed]   ✓ Translations: ${inserted} new key(s) inserted (${existingCount} already existed, ${total} total in seed)`);
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
  await syncTranslations();
  await syncEmailTemplates();
  await migrateBoxSlugs();

  const duration = (performance.now() - start).toFixed(0);
  console.log(`[seed] Seed complete in ${duration}ms.`);
}
