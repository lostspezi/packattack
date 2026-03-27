import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ITranslation extends Document {
  namespace: string;
  key: string;
  values: Map<string, string>;
  updatedAt: Date;
  updatedBy: Types.ObjectId | null;
}

const TranslationSchema = new Schema<ITranslation>(
  {
    namespace: { type: String, required: true },
    key: { type: String, required: true },
    values: { type: Map, of: String, default: new Map() },
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
