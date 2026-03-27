import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and - are allowed"),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  acceptTos: z.literal(true),
  acceptPrivacy: z.literal(true),
  dateOfBirth: z.string().min(1),
  acceptAge: z.literal(true),
});

export const onboardingSchema = z.object({
  name: z.string().min(2).max(50),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and - are allowed"),
  email: z.string().email(),
  password: z.string().min(8).max(100).optional(),
  dateOfBirth: z.string().min(1),
  acceptTos: z.literal(true),
  acceptPrivacy: z.literal(true),
  acceptAge: z.literal(true),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(50),
  username: z.string().min(3).max(30),
  bio: z.string().max(500).nullable(),
  socialLinks: z.object({
    discord: z.string().optional(),
    twitch: z.string().optional(),
    twitter: z.string().optional(),
    youtube: z.string().optional(),
  }),
  publicProfile: z.boolean(),
});

export const settingsSchema = z.object({
  language: z.enum(["de", "en"]),
  theme: z.enum(["dark", "light"]),
  notifications: z.object({
    email: z.boolean(),
    browser: z.boolean(),
  }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export const shopApplySchema = z.object({
  companyName: z.string().min(2).max(100),
});

// Coin Purchase System
export const coinPackageSchema = z.object({
  name: z.object({
    de: z.string().min(1).max(100),
    en: z.string().min(1).max(100),
  }),
  baseCoins: z.number().int().min(1).max(1000),
  bonusCoins: z.number().int().min(0).max(500).default(0),
  priceEurCents: z.number().int().min(100).max(100000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  icon: z.string().max(50).nullable().default(null),
  highlightLabel: z
    .object({
      de: z.string().max(50),
      en: z.string().max(50),
    })
    .nullable()
    .default(null),
});

export const coinPackageUpdateSchema = coinPackageSchema.partial();

export const checkoutSchema = z.object({
  packageId: z.string().min(1),
  withdrawalConsent: z.literal(true, {
    errorMap: () => ({ message: "Withdrawal consent is required" }),
  }),
});

export const invoiceSettingsSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyAddress: z.object({
    street: z.string().min(1).max(200),
    zip: z.string().min(1).max(20),
    city: z.string().min(1).max(100),
    country: z.string().min(1).max(100),
  }),
  taxId: z.string().min(1).max(50),
  taxRate: z.number().min(0).max(100),
  bankDetails: z
    .object({
      iban: z.string().min(1).max(50),
      bic: z.string().min(1).max(20),
      bankName: z.string().min(1).max(100),
    })
    .nullable()
    .default(null),
  email: z.string().email().max(200),
  phone: z.string().max(50).nullable().default(null),
  website: z.string().url().max(200).nullable().default(null),
  logoUrl: z.string().max(500).nullable().default(null),
  invoicePrefix: z.string().min(1).max(10),
  footerText: z
    .object({
      de: z.string().max(500),
      en: z.string().max(500),
    })
    .nullable()
    .default(null),
});
