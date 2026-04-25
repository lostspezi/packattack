import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBinderLike extends Document {
  binderId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const BinderLikeSchema = new Schema<IBinderLike>(
  {
    binderId: { type: Schema.Types.ObjectId, ref: "Binder", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BinderLikeSchema.index({ binderId: 1, userId: 1 }, { unique: true });
BinderLikeSchema.index({ userId: 1, createdAt: -1 });
BinderLikeSchema.index({ binderId: 1, createdAt: -1 });

const BinderLike: Model<IBinderLike> =
  mongoose.models.BinderLike ??
  mongoose.model<IBinderLike>("BinderLike", BinderLikeSchema);

export default BinderLike;
