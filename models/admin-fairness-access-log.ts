import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AdminFairnessAccessType =
  | "view_seed"        // loaded a user's active or revealed server seed
  | "view_commitment"  // read a commitment document with server seed
  | "freeform_verify"; // used the admin-only freeform verifier

export interface IAdminFairnessAccessLog extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  targetUserId: Types.ObjectId | null;
  targetSeedId: Types.ObjectId | null;
  targetCommitmentId: Types.ObjectId | null;
  accessType: AdminFairnessAccessType;
  context: string | null;
  createdAt: Date;
}

const AdminFairnessAccessLogSchema = new Schema<IAdminFairnessAccessLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    targetSeedId: { type: Schema.Types.ObjectId, ref: "FairnessSeed", default: null },
    targetCommitmentId: { type: Schema.Types.ObjectId, ref: "PackOpenCommitment", default: null },
    accessType: {
      type: String,
      enum: ["view_seed", "view_commitment", "freeform_verify"],
      required: true,
    },
    context: { type: String, default: null, maxlength: 512 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AdminFairnessAccessLogSchema.index({ adminId: 1, createdAt: -1 });
AdminFairnessAccessLogSchema.index({ targetUserId: 1, createdAt: -1 });
AdminFairnessAccessLogSchema.index({ targetSeedId: 1, createdAt: -1 });

const AdminFairnessAccessLog: Model<IAdminFairnessAccessLog> =
  mongoose.models.AdminFairnessAccessLog ??
  mongoose.model<IAdminFairnessAccessLog>(
    "AdminFairnessAccessLog",
    AdminFairnessAccessLogSchema,
  );

export default AdminFairnessAccessLog;
