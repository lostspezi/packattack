import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ITranslation extends Document {
  namespace: string;
  key: string;
  values: { de: string; en: string };
  updatedAt: Date;
  updatedBy: Types.ObjectId | null;
}

const TranslationSchema = new Schema<ITranslation>(
  {
    namespace: { type: String, required: true },
    key: { type: String, required: true },
    values: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

TranslationSchema.index({ namespace: 1, key: 1 }, { unique: true });
TranslationSchema.index({ namespace: 1 });

const Translation: Model<ITranslation> =
  mongoose.models.Translation ??
  mongoose.model<ITranslation>("Translation", TranslationSchema);

export default Translation;
