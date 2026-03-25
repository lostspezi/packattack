import connectDB from "./db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";
import Translation from "@/models/translation";
import EmailTemplate from "@/models/email-template";
import bcrypt from "bcryptjs";
import { translationSeedData } from "@/seed/translations";
import { emailTemplateSeedData } from "@/seed/email-templates";

export async function runSeed() {
  await connectDB();
  const userCount = await User.countDocuments();
  if (userCount > 0) return; // Already seeded

  console.log("[seed] First start detected — seeding database...");

  // 1. Create super admin
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await User.create({
    name: "Super Admin",
    username: "admin",
    email: "admin@packattack.gg",
    emailVerified: new Date(),
    password: hashedPassword,
    role: "super_admin",
    preferences: { language: "en", theme: "dark", notifications: { email: true, browser: true } },
    publicProfile: false,
    consents: {
      tos: { accepted: true, version: "1.0", acceptedAt: new Date() },
      privacy: { accepted: true, version: "1.0", acceptedAt: new Date() },
    },
  });

  // 2. Create platform settings
  await PlatformSettings.create({
    tosVersion: "1.0",
    privacyVersion: "1.0",
    updatedAt: new Date(),
  });

  // 3. Seed translations
  await Translation.insertMany(translationSeedData);

  // 4. Seed email templates
  await EmailTemplate.insertMany(emailTemplateSeedData);

  console.log("[seed] Database seeded successfully.");
}
