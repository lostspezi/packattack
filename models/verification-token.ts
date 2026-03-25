import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IVerificationToken extends Document {
  userId: Types.ObjectId;
  token: string;
  type: "email_verify" | "pwd_reset";
  expires: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    type: {
      type: String,
      enum: ["email_verify", "pwd_reset"],
      required: true,
    },
    expires: { type: Date, required: true },
  },
  { timestamps: false }
);

VerificationTokenSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

const VerificationToken: Model<IVerificationToken> =
  mongoose.models.VerificationToken ??
  mongoose.model<IVerificationToken>(
    "VerificationToken",
    VerificationTokenSchema
  );

export default VerificationToken;
