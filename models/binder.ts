import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { generateUniqueSlug } from "@/lib/slug";

export const BINDER_TYPES = ["free", "set-template"] as const;
export type BinderType = (typeof BINDER_TYPES)[number];

export const BINDER_THEMES = [
  "classic",
  "premium-gold",
  "holo",
  "wald",
  "ozean",
] as const;
export type BinderTheme = (typeof BINDER_THEMES)[number];

export const SLOTS_PER_PAGE = 9;
export const MAX_PAGES = 200;

export interface IBinderSlot {
  position: number;
  packPullId: Types.ObjectId | null;
  expectedCardId: Types.ObjectId | null;
  note: string | null;
}

export interface IBinderPage {
  title: string | null;
  backgroundId: string | null;
  slots: IBinderSlot[];
}

export interface IBinder extends Document {
  userId: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  type: BinderType;
  setTemplate: { game: string; set: string } | null;
  theme: BinderTheme;
  coverPackPullId: Types.ObjectId | null;
  pages: IBinderPage[];
  isPublic: boolean;
  publishedAt: Date | null;
  likeCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SlotSchema = new Schema<IBinderSlot>(
  {
    position: { type: Number, required: true, min: 0, max: SLOTS_PER_PAGE - 1 },
    packPullId: {
      type: Schema.Types.ObjectId,
      ref: "PackPull",
      default: null,
    },
    expectedCardId: {
      type: Schema.Types.ObjectId,
      ref: "Card",
      default: null,
    },
    note: { type: String, default: null, maxlength: 200 },
  },
  { _id: false },
);

const PageSchema = new Schema<IBinderPage>(
  {
    title: { type: String, default: null, maxlength: 60 },
    backgroundId: { type: String, default: null },
    slots: { type: [SlotSchema], default: () => [] },
  },
  { _id: false },
);

const SetTemplateSchema = new Schema(
  {
    game: { type: String, required: true },
    set: { type: String, required: true },
  },
  { _id: false },
);

const BinderSchema = new Schema<IBinder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: { type: String, required: false },
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 500 },
    type: { type: String, enum: BINDER_TYPES, required: true },
    setTemplate: { type: SetTemplateSchema, default: null },
    theme: { type: String, enum: BINDER_THEMES, default: "classic" },
    coverPackPullId: {
      type: Schema.Types.ObjectId,
      ref: "PackPull",
      default: null,
    },
    pages: { type: [PageSchema], default: () => [] },
    isPublic: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    likeCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

BinderSchema.index({ slug: 1 }, { unique: true });
BinderSchema.index({ userId: 1, updatedAt: -1 });
BinderSchema.index({ isPublic: 1, publishedAt: -1 });
BinderSchema.index({ isPublic: 1, likeCount: -1 });
BinderSchema.index({ isPublic: 1, "setTemplate.game": 1, publishedAt: -1 });

BinderSchema.pre("save", async function () {
  if (this.slug) return;
  const BinderModel = this.constructor as Model<IBinder>;
  this.slug = await generateUniqueSlug(BinderModel);
});

const Binder: Model<IBinder> =
  mongoose.models.Binder ?? mongoose.model<IBinder>("Binder", BinderSchema);

export default Binder;
