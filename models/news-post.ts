import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type NewsPostType = "release" | "event" | "community";
export type NewsPostStatus = "draft" | "published";

export interface INewsPost extends Document {
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  type: NewsPostType;
  imageId: Types.ObjectId | null;
  imageAlt: string;
  status: NewsPostStatus;
  publishedAt: Date | null;
  authorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NewsPostSchema = new Schema<INewsPost>(
  {
    title: { type: String, required: true, maxlength: 120, trim: true },
    slug: { type: String, unique: true },
    body: { type: String, required: true, maxlength: 10000 },
    excerpt: { type: String, default: "", maxlength: 280, trim: true },
    type: {
      type: String,
      enum: ["release", "event", "community"],
      required: true,
    },
    imageId: { type: Schema.Types.ObjectId, default: null },
    imageAlt: { type: String, default: "", maxlength: 200, trim: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      required: true,
    },
    publishedAt: { type: Date, default: null },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned.replace(/^-+|-+$/g, "");
}

NewsPostSchema.pre("save", async function () {
  if (this.slug) return;

  const NewsPostModel = this.constructor as Model<INewsPost>;
  const base = slugify(this.title) || "news";

  let candidate = base;
  let suffix = 0;

  while (await NewsPostModel.findOne({ slug: candidate }).select("_id").lean()) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  this.slug = candidate;
});

NewsPostSchema.index({ status: 1, publishedAt: -1 });
NewsPostSchema.index({ slug: 1 }, { unique: true });
NewsPostSchema.index({ authorId: 1 });

const NewsPost: Model<INewsPost> =
  mongoose.models.NewsPost ?? mongoose.model<INewsPost>("NewsPost", NewsPostSchema);

export default NewsPost;
export { slugify };
