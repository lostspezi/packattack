import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  badges: Array<{
    key: string;
    label: string;
    active: boolean;
    tone: "neutral" | "green" | "gold" | "lilac" | "blue";
    awardedAt: Date;
    expiresAt: Date | null;
    sortOrder: number;
  }>;
  name: string;
  username: string;
  email: string;
  coins: number;
  elo: number;
  battleStats: {
    wins: number;
    losses: number;
    streak: number;
    bestStreak: number;
    totalBattles: number;
    battlesCreated: number;
  };
  stripeCustomerId: string | null;
  stripeIdentityVerificationId: string | null;
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
  emailVerified: Date | null;
  password: string | null;
  image: string | null;
  role: "user" | "shop" | "moderator" | "admin" | "super_admin";
  bio: string | null;
  dateOfBirth: Date | null;
  socialLinks: {
    discord?: string;
    twitch?: string;
    twitter?: string;
    youtube?: string;
  };
  preferences: {
    language: "de" | "en";
    theme: "dark" | "light";
    streamerMode: boolean;
    notifications: {
      email: boolean;
      browser: boolean;
    };
  };
  publicProfile: boolean;
  consents: {
    tos: {
      accepted: boolean;
      version: string;
      acceptedAt: Date;
    };
    privacy: {
      accepted: boolean;
      version: string;
      acceptedAt: Date;
    };
    ageVerification: {
      accepted: boolean;
      acceptedAt: Date;
    };
  };
  onboardingCompleted: boolean;
  tour: {
    completed: boolean;
    skippedAt: Date | null;
    completedSteps: string[];
    lastPromptAt: Date | null;
    sessionCountSincePrompt: number;
  };
  shippingAddress: {
    name: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    country: "DE" | "AT" | "CH" | null;
  } | null;
  reservationRulesAccepted: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BadgeSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, maxlength: 64 },
    active: { type: Boolean, default: true },
    tone: {
      type: String,
      enum: ["neutral", "green", "gold", "lilac", "blue"],
      default: "neutral",
    },
    awardedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    badges: {
      type: [BadgeSchema],
      default: [],
    },
    name: { type: String, required: true },
    username: { type: String, unique: true, sparse: true, default: null },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Date, default: null },
    password: { type: String, default: null },
    image: { type: String, default: null },
    role: {
      type: String,
      enum: ["user", "shop", "moderator", "admin", "super_admin"],
      default: "user",
    },
    bio: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    socialLinks: {
      discord: { type: String },
      twitch: { type: String },
      twitter: { type: String },
      youtube: { type: String },
    },
    preferences: {
      language: {
        type: String,
        enum: ["de", "en"],
        default: "en",
      },
      theme: {
        type: String,
        enum: ["dark", "light"],
        default: "dark",
      },
      streamerMode: { type: Boolean, default: false },
      notifications: {
        email: { type: Boolean, default: true },
        browser: { type: Boolean, default: true },
      },
    },
    publicProfile: { type: Boolean, default: false },
    consents: {
      tos: {
        accepted: { type: Boolean, default: false },
        version: { type: String, default: "" },
        acceptedAt: { type: Date },
      },
      privacy: {
        accepted: { type: Boolean, default: false },
        version: { type: String, default: "" },
        acceptedAt: { type: Date },
      },
      ageVerification: {
        accepted: { type: Boolean, default: false },
        acceptedAt: { type: Date },
      },
    },
    onboardingCompleted: { type: Boolean, default: false },
    tour: {
      type: new Schema(
        {
          completed: { type: Boolean, default: false },
          skippedAt: { type: Date, default: null },
          completedSteps: { type: [String], default: [] },
          lastPromptAt: { type: Date, default: null },
          sessionCountSincePrompt: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: () => ({
        completed: false,
        skippedAt: null,
        completedSteps: [],
        lastPromptAt: null,
        sessionCountSincePrompt: 0,
      }),
    },
    coins: { type: Number, default: 0 },
    elo: { type: Number, default: 1000 },
    battleStats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      totalBattles: { type: Number, default: 0 },
      battlesCreated: { type: Number, default: 0 },
    },
    stripeCustomerId: { type: String, default: null },
    stripeIdentityVerificationId: { type: String, default: null },
    identityVerified: { type: Boolean, default: false },
    identityVerifiedAt: { type: Date, default: null },
    shippingAddress: {
      type: new Schema(
        {
          name: { type: String, default: null },
          street: { type: String, default: null },
          city: { type: String, default: null },
          zip: { type: String, default: null },
          country: { type: String, enum: ["DE", "AT", "CH"], default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    reservationRulesAccepted: { type: Date, default: null },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
