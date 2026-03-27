import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILanguage extends Document {
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Language: Model<ILanguage> =
  mongoose.models.Language ??
  mongoose.model<ILanguage>("Language", LanguageSchema);

export default Language;
