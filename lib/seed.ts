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
    console.log(`[seed] Skipping initial seed - ${userCount} user(s) already exist.`);
    return;
  }

  console.log("[seed] First start detected - creating admin user and platform settings...");

  const hashedPassword = await bcrypt.hash("admin123", 12);

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
    console.log("[seed]   OK Super Admin user created (admin@packattack.gg)");
  } else {
    console.log("[seed]   OK Super Admin user already exists");
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
    console.log("[seed]   OK Platform settings created (ToS v1.0, Privacy v1.0)");
  } else {
    console.log("[seed]   OK Platform settings already exist");
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
    await invalidateLanguageCache();
    console.log("[seed]   OK Default language created (de - Deutsch)");
  } else {
    console.log("[seed]   OK Default language already exists");
  }

}

function hasSuspiciousEncodingArtifacts(value: string): boolean {
  return /(^\?[A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF])|([A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF]\?[A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF])|(\?\s*[A-Za-z\u00C4\u00D6\u00DC\u00E4\u00F6\u00FC\u00DF])|Ã.|â.|�/.test(value);
}

const legacyGermanTranslationValues: Record<string, string[]> = {
  "feedback:common_assignedToAll": ["Allen zugewiesen"],
  "feedback:form_requiredError": ["Titel und Details sind erforderlich", "Titel und Details sind erforderlich."],
  "feedback:detail_saveTriage": ["Triage speichern"],
  "feedback:detail_triageTitle": ["Triage"],
  "feedback:detail_triageSubtitle": ["Verwalte Status, Zuweisung und Tags."],
  "feedback:detail_triageSaved": ["Triage aktualisiert", "Triage wurde aktualisiert."],
  "feedback:analytics_subtitle": ["Sieh, wo sich Pain Points sammeln und wo die Queue langsamer wird.", "Sieh, wo sich Probleme sammeln und wo die Queue langsamer wird."],
};

async function syncTranslations() {
  const total = translationSeedData.length;
  const existingCount = await Translation.countDocuments();
  let inserted = 0;
  let repaired = 0;
  const touchedNamespaces = new Set<string>();

  const existingTranslations = await Translation.find({})
    .select("namespace key values")
    .lean();

  const existingMap = new Map(
    existingTranslations.map((item) => [`${item.namespace}:${item.key}`, item])
  );

  for (const item of translationSeedData) {
    const mapKey = `${item.namespace}:${item.key}`;
    const existing = existingMap.get(mapKey) as
      | { namespace: string; key: string; values?: Record<string, string> }
      | undefined;

    if (!existing) {
      const result = await Translation.updateOne(
        { namespace: item.namespace, key: item.key },
        { $setOnInsert: item },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
        touchedNamespaces.add(item.namespace);
      }
      continue;
    }

    const currentGerman = existing.values?.de;
    const canonicalGerman = item.values.de;

    const legacyGermanValues = legacyGermanTranslationValues[mapKey] ?? [];
    const shouldRepairGerman =
      typeof currentGerman === "string" &&
      typeof canonicalGerman === "string" &&
      currentGerman !== canonicalGerman &&
      (hasSuspiciousEncodingArtifacts(currentGerman) || legacyGermanValues.includes(currentGerman));

    if (shouldRepairGerman) {
      await Translation.updateOne(
        { namespace: item.namespace, key: item.key },
        { $set: { "values.de": canonicalGerman } }
      );
      repaired++;
      touchedNamespaces.add(item.namespace);
    }
  }

  if (touchedNamespaces.size > 0) {
    await Promise.all([...touchedNamespaces].map((namespace) => invalidateTranslationCache(namespace)));
  }

  if (inserted > 0 || repaired > 0) {
    console.log(
      `[seed]   OK Translations: ${inserted} new key(s), ${repaired} repaired key(s) (${existingCount} already existed, ${total} total in seed)${touchedNamespaces.size > 0 ? " - cache invalidated" : ""}`
    );
  } else {
    console.log(`[seed]   OK Translations: all ${total} key(s) up to date`);
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
    console.log(`[seed]   OK Email templates: ${inserted} new template(s) inserted (${existingCount} already existed, ${total} total in seed)`);
  } else {
    console.log(`[seed]   OK Email templates: all ${total} template(s) up to date`);
  }
}

async function migrateBoxSlugs() {
  const Box = (await import("@/models/box")).default;
  const boxes = await Box.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] });
  if (boxes.length === 0) return;

  for (const box of boxes) {
    box.slug = undefined as unknown as string;
    await box.save();
  }

  console.log(`[seed]   OK Generated slugs for ${boxes.length} existing box(es)`);
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
