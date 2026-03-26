import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUserInventory extends Document {
  userId: Types.ObjectId;
  cardId: Types.ObjectId;
  boxId: Types.ObjectId;
  pullId: Types.ObjectId;
  rarity: string;
  claimedAt: Date;
}

const UserInventorySchema = new Schema<IUserInventory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    boxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    pullId: { type: Schema.Types.ObjectId, ref: "PackPull", required: true },
    rarity: { type: String, required: true },
    claimedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

UserInventorySchema.index({ userId: 1 });
UserInventorySchema.index({ userId: 1, cardId: 1 });

const UserInventory: Model<IUserInventory> =
  mongoose.models.UserInventory ?? mongoose.model<IUserInventory>("UserInventory", UserInventorySchema);

export default UserInventory;
