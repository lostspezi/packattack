import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPackiKnowledge extends Document {
  topic: string;
  correction: string;
  priority: number;
  active: boolean;
  language: string | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PackiKnowledgeSchema = new Schema<IPackiKnowledge>(
  {
    topic: { type: String, required: true, trim: true, maxlength: 120 },
    correction: { type: String, required: true, trim: true, maxlength: 2000 },
    priority: { type: Number, default: 50, min: 0, max: 100 },
    active: { type: Boolean, default: true },
    language: { type: String, default: null, maxlength: 5 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

PackiKnowledgeSchema.index({ active: 1, priority: -1, createdAt: -1 });
PackiKnowledgeSchema.index({ language: 1, active: 1 });

const PackiKnowledge: Model<IPackiKnowledge> =
  mongoose.models.PackiKnowledge ??
  mongoose.model<IPackiKnowledge>("PackiKnowledge", PackiKnowledgeSchema);

export default PackiKnowledge;
