import { z } from "zod";
import {
  CHAT_ADMIN_ACTIONS,
  CHAT_REPORT_CATEGORIES,
  CHAT_RESTRICTION_TYPES,
  CHAT_ROOM_MODES,
  CHAT_SOUND_MODES,
} from "@/lib/chat-constants";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_WAITING_ON,
} from "@/lib/feedback-constants";

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
  withdrawalConsent: z.literal(true, { error: "Withdrawal consent is required" }),
});

const feedbackTagsSchema = z.array(z.string().trim().min(1).max(32)).max(8);

const feedbackContextSchema = z.object({
  route: z.string().max(500).nullable().optional(),
  locale: z.string().min(2).max(8).optional(),
  userAgent: z.string().max(1000).nullable().optional(),
  viewportWidth: z.number().int().positive().max(10000).nullable().optional(),
  viewportHeight: z.number().int().positive().max(10000).nullable().optional(),
  releaseId: z.string().max(128).nullable().optional(),
  objectType: z.string().max(64).nullable().optional(),
  objectId: z.string().max(128).nullable().optional(),
});

export const createFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  title: z.string().trim().min(4).max(150),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  severity: z.enum(FEEDBACK_SEVERITIES).optional(),
  areaTags: feedbackTagsSchema.optional(),
  issueTags: feedbackTagsSchema.optional(),
  context: feedbackContextSchema.optional(),
  source: z.enum(["dashboard", "account", "settings", "admin", "manual"]).optional(),
});

export const updateFeedbackSchema = z.object({
  title: z.string().trim().min(4).max(150).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  kind: z.enum(FEEDBACK_KINDS).optional(),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  severity: z.enum(FEEDBACK_SEVERITIES).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  waitingOn: z.enum(FEEDBACK_WAITING_ON).optional(),
  areaTags: feedbackTagsSchema.optional(),
  issueTags: feedbackTagsSchema.optional(),
  assignedTo: z.string().nullable().optional(),
});

export const createFeedbackMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional(),
});

export const updateFeedbackMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const createChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export const chatHistoryQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  beforeVisibleSeq: z.number().int().min(1).optional(),
});

export const chatReadStateSchema = z.object({
  lastReadVisibleSeq: z.number().int().min(0),
});

export const createChatReportSchema = z.object({
  messageId: z.string().min(1),
  category: z.enum(CHAT_REPORT_CATEGORIES),
  note: z.string().trim().max(500).optional(),
});

export const updateChatPreferencesSchema = z
  .object({
    muted: z.boolean().optional(),
    soundMode: z.enum(CHAT_SOUND_MODES).optional(),
    browserNotifications: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one preference must be provided",
  });

export const adminChatActionSchema = z.object({
  action: z.enum(CHAT_ADMIN_ACTIONS),
  messageId: z.string().optional(),
  targetUserId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
  roomMode: z.enum(CHAT_ROOM_MODES).optional(),
  slowModeSeconds: z.number().int().min(0).max(300).optional(),
});

export const adminChatRestrictionsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  status: z.enum(CHAT_RESTRICTION_TYPES).optional(),
});

export const adminChatUserSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export const adminChatLogsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  target: z.string().trim().max(120).optional(),
  actor: z.string().trim().max(120).optional(),
  actionType: z.enum(CHAT_ADMIN_ACTIONS).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

