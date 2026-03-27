import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInvoiceSettings extends Document {
  companyName: string;
  companyAddress: {
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  taxId: string;
  taxRate: number;
  bankDetails: {
    iban: string;
    bic: string;
    bankName: string;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  footerText: { de: string; en: string } | null;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const InvoiceSettingsSchema = new Schema<IInvoiceSettings>(
  {
    companyName: { type: String, default: "" },
    companyAddress: {
      street: { type: String, default: "" },
      zip: { type: String, default: "" },
      city: { type: String, default: "" },
      country: { type: String, default: "Deutschland" },
    },
    taxId: { type: String, default: "" },
    taxRate: { type: Number, default: 19 },
    bankDetails: {
      type: {
        iban: { type: String },
        bic: { type: String },
        bankName: { type: String },
      },
      default: null,
    },
    email: { type: String, default: "" },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    logoUrl: { type: String, default: null },
    invoicePrefix: { type: String, default: "PA" },
    nextInvoiceSequence: { type: Number, default: 1 },
    footerText: {
      type: {
        de: { type: String },
        en: { type: String },
      },
      default: null,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const InvoiceSettings =
  mongoose.models.InvoiceSettings ||
  mongoose.model<IInvoiceSettings>("InvoiceSettings", InvoiceSettingsSchema);

export default InvoiceSettings;
