import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IEmailTemplate extends Document {
  slug: string;
  name: string;
  subject: { de: string; en: string };
  body: { de: string; en: string };
  variables: string[];
  updatedAt: Date;
  updatedBy: Types.ObjectId | null;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subject: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    body: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    variables: { type: [String], required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const EmailTemplate: Model<IEmailTemplate> =
  mongoose.models.EmailTemplate ??
  mongoose.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema);

export default EmailTemplate;
