import mongoose, { Document, Model, Schema } from "mongoose";

export interface IMigration extends Document {
  name: string;
  executedAt: Date;
}

const MigrationSchema = new Schema<IMigration>({
  name: { type: String, required: true, unique: true },
  executedAt: { type: Date, default: Date.now },
});

const Migration: Model<IMigration> =
  mongoose.models.Migration ?? mongoose.model<IMigration>("Migration", MigrationSchema);

export default Migration;
