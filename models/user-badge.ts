import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUserBadge extends Document {
  userId: Types.ObjectId;
  badgeId: Types.ObjectId;
  badgeKeySnapshot: string;
  awardedAt: Date;
  awardedByUserId: Types.ObjectId | null;
  awardReason: string | null;
  note: string | null;
  active: boolean;
  revokedAt: Date | null;
  revokedByUserId: Types.ObjectId | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserBadgeSchema = new Schema<IUserBadge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    badgeId: { type: Schema.Types.ObjectId, ref: "Badge", required: true, index: true },
    badgeKeySnapshot: { type: String, required: true, trim: true, maxlength: 64, index: true },
    awardedAt: { type: Date, default: Date.now },
    awardedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    awardReason: { type: String, default: null, maxlength: 200 },
    note: { type: String, default: null, maxlength: 300 },
    active: { type: Boolean, default: true, index: true },
    revokedAt: { type: Date, default: null },
    revokedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, default: null, maxlength: 200 },
  },
  { timestamps: true }
);

UserBadgeSchema.index(
  { userId: 1, badgeId: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
  }
);

const UserBadge: Model<IUserBadge> =
  mongoose.models.UserBadge ?? mongoose.model<IUserBadge>("UserBadge", UserBadgeSchema);

export default UserBadge;
