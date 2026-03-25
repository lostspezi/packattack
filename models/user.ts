import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  username: string;
  email: string;
  emailVerified: Date | null;
  password: string | null;
  image: string | null;
  role: "user" | "shop" | "moderator" | "admin" | "super_admin";
  bio: string | null;
  socialLinks: {
    discord?: string;
    twitch?: string;
    twitter?: string;
    youtube?: string;
  };
  preferences: {
    language: "de" | "en";
    theme: "dark" | "light";
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
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
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
    },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
