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
  if (userCount > 0) return; // Already seeded

  console.log("[seed] First start detected — seeding admin user and platform settings...");

  // 1. Create super admin
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await User.create({
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
  });

  // 2. Create platform settings
  await PlatformSettings.create({
    tosVersion: "1.0",
    privacyVersion: "1.0",
    updatedAt: new Date(),
  });

  console.log("[seed] Admin user and platform settings created.");
}

async function syncTranslations() {
  let inserted = 0;
  for (const item of translationSeedData) {
    const exists = await Translation.exists({ namespace: item.namespace, key: item.key });
    if (!exists) {
      await Translation.create(item);
      inserted++;
    }
  }
  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} missing translation key(s).`);
  }
}

async function syncEmailTemplates() {
  let inserted = 0;
  for (const item of emailTemplateSeedData) {
    const exists = await EmailTemplate.exists({ slug: item.slug });
    if (!exists) {
      await EmailTemplate.create(item);
      inserted++;
    }
  }
  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} missing email template(s).`);
  }
}

export async function runSeed() {
  await connectDB();
  await runInitialSeed();
  await syncTranslations();
  await syncEmailTemplates();
}
