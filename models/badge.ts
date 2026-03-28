import mongoose, { Document, Model, Schema } from "mongoose";
import type { BadgeTone } from "@/types/badges";

export interface IBadge extends Document {
  key: string;
  slug: string;
  label: string;
  iconUrl: string | null;
  description: string | null;
  tone: BadgeTone;
  active: boolean;
  sortOrder: number;
  visibility: "public" | "staff_only";
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BadgeSchema = new Schema<IBadge>(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
    slug: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 64 },
    iconUrl: { type: String, default: null, maxlength: 300 },
    description: { type: String, default: null, maxlength: 300 },
    tone: {
      type: String,
      enum: ["neutral", "green", "gold", "lilac", "blue"],
      default: "neutral",
    },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    visibility: {
      type: String,
      enum: ["public", "staff_only"],
      default: "public",
    },
    category: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true }
);

BadgeSchema.index({ active: 1, sortOrder: -1 });

const Badge: Model<IBadge> =
  mongoose.models.Badge ?? mongoose.model<IBadge>("Badge", BadgeSchema);

export default Badge;
