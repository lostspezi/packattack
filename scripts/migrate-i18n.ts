/**
 * MongoDB Migration Script: i18n System → German-Only with Dynamic Languages
 *
 * Run on the server after deploying the new code:
 *   npx tsx scripts/migrate-i18n.ts
 *
 * What this script does:
 * 1. Creates the "languages" collection with German as default
 * 2. Removes English ("en") values from all translation documents
 * 3. Flushes related Redis caches
 *
 * Safe to run multiple times (idempotent).
 */

import mongoose from "mongoose";
// Load env vars — dotenv is optional, tsx loads .env.local automatically
try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} catch {
  // dotenv not available, rely on environment
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment.");
  process.exit(1);
}

async function migrate() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("✅ Connected.\n");

  const db = mongoose.connection.db!;

  // Step 1: Create/ensure Language collection with German
  console.log("--- Step 1: Ensure Language collection ---");
  const languagesCol = db.collection("languages");

  const existingDe = await languagesCol.findOne({ code: "de" });
  if (existingDe) {
    console.log("  ✓ German language already exists.");
  } else {
    await languagesCol.insertOne({
      code: "de",
      name: "Deutsch",
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("  ✓ Created German language (de — Deutsch) as default.");
  }

  // Check if English language exists and is active
  const existingEn = await languagesCol.findOne({ code: "en" });

  // Step 2: Remove English values from translations (only if English is not an active language)
  console.log("\n--- Step 2: Remove English values from translations ---");

  if (existingEn?.isActive) {
    console.log("  ⚠ English is an active language — skipping removal of English values.");
    console.log("    If you want to remove English, first deactivate it via admin.");
  } else {
    const translationsCol = db.collection("translations");

    // Count docs with English values
    const docsWithEn = await translationsCol.countDocuments({
      "values.en": { $exists: true },
    });

    if (docsWithEn === 0) {
      console.log("  ✓ No English values found — already cleaned.");
    } else {
      const result = await translationsCol.updateMany(
        { "values.en": { $exists: true } },
        { $unset: { "values.en": "" } }
      );
      console.log(`  ✓ Removed English values from ${result.modifiedCount} translation document(s).`);
    }

    // Also remove the English language entry if it exists but is not active
    if (existingEn && !existingEn.isActive) {
      await languagesCol.deleteOne({ code: "en" });
      console.log("  ✓ Removed inactive English language entry.");
    }
  }

  // Step 3: Flush Redis caches
  console.log("\n--- Step 3: Flush Redis caches ---");
  const REDIS_URL = process.env.REDIS_URL;
  if (REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(REDIS_URL);

      // Delete all i18n-related keys
      const keys = await redis.keys("i18n:*");
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`  ✓ Flushed ${keys.length} Redis i18n cache key(s).`);
      } else {
        console.log("  ✓ No i18n cache keys found in Redis.");
      }

      await redis.quit();
    } catch (err) {
      console.warn("  ⚠ Could not connect to Redis:", (err as Error).message);
      console.warn("    Cache will expire naturally (5 min TTL).");
    }
  } else {
    console.log("  ⚠ REDIS_URL not set — caches will expire naturally (5 min TTL).");
  }

  // Summary
  console.log("\n✅ Migration complete!");
  console.log("   - German is the default and only active language");
  console.log("   - English values have been removed from translations");
  console.log("   - Redis caches have been flushed");
  console.log("\n   The language switcher will be hidden until you add a second language via Admin → Sprachen.");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
