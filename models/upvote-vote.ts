import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IUpvoteVote extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  itemRefId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UpvoteVoteSchema = new Schema<IUpvoteVote>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "UpvoteCampaign", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemRefId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

UpvoteVoteSchema.index(
  { campaignId: 1, userId: 1, itemRefId: 1 },
  { unique: true }
);
UpvoteVoteSchema.index({ campaignId: 1, userId: 1 });
UpvoteVoteSchema.index({ campaignId: 1, itemRefId: 1 });

const UpvoteVote: Model<IUpvoteVote> =
  mongoose.models.UpvoteVote ?? mongoose.model<IUpvoteVote>("UpvoteVote", UpvoteVoteSchema);

export default UpvoteVote;
