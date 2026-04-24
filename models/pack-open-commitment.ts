import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPoolSnapshotEntry {
  cardId: Types.ObjectId;
  weight: number; // integer, already scaled via WEIGHT_SCALE from lib/fairness
  stockAtOpen: number;
}

export interface IPackOpenCommitment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  packGroupId: string;
  boxId: Types.ObjectId;
  serverSeedId: Types.ObjectId;
  serverSeedHashAtOpen: string;
  clientSeed: string;
  nonceStart: number;
  nonceEnd: number;
  poolSnapshot: IPoolSnapshotEntry[];
  poolHash: string;
  createdAt: Date;
}

const PoolSnapshotEntrySchema = new Schema<IPoolSnapshotEntry>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    weight: { type: Number, required: true, min: 0 },
    stockAtOpen: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PackOpenCommitmentSchema = new Schema<IPackOpenCommitment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packGroupId: { type: String, required: true, unique: true },
    boxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    serverSeedId: { type: Schema.Types.ObjectId, ref: "FairnessSeed", required: true },
    serverSeedHashAtOpen: { type: String, required: true },
    clientSeed: { type: String, required: true },
    nonceStart: { type: Number, required: true, min: 0 },
    nonceEnd: { type: Number, required: true, min: 0 },
    poolSnapshot: { type: [PoolSnapshotEntrySchema], required: true },
    poolHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PackOpenCommitmentSchema.index({ userId: 1, createdAt: -1 });
PackOpenCommitmentSchema.index({ serverSeedId: 1 });

const PackOpenCommitment: Model<IPackOpenCommitment> =
  mongoose.models.PackOpenCommitment ??
  mongoose.model<IPackOpenCommitment>("PackOpenCommitment", PackOpenCommitmentSchema);

export default PackOpenCommitment;
