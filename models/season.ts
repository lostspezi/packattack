import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISeasonReward {
  minPlacement: number;
  maxPlacement: number;
  type: "badge" | "coins";
  badgeKey: string | null;
  coinAmount: number | null;
}

export interface ISeason extends Document {
  name: { de: string; en: string };
  number: number;
  startsAt: Date;
  endsAt: Date;
  status: "upcoming" | "active" | "ended";
  rewards: ISeasonReward[];
  createdAt: Date;
  updatedAt: Date;
}

const SeasonRewardSchema = new Schema<ISeasonReward>(
  {
    minPlacement: { type: Number, required: true },
    maxPlacement: { type: Number, required: true },
    type: { type: String, enum: ["badge", "coins"], required: true },
    badgeKey: { type: String, default: null },
    coinAmount: { type: Number, default: null },
  },
  { _id: false }
);

const SeasonSchema = new Schema<ISeason>(
  {
    name: {
      de: { type: String, required: true },
      en: { type: String, required: true },
    },
    number: { type: Number, required: true, unique: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["upcoming", "active", "ended"],
      default: "upcoming",
      required: true,
    },
    rewards: { type: [SeasonRewardSchema], default: [] },
  },
  { timestamps: true }
);

SeasonSchema.index({ status: 1 });

const Season: Model<ISeason> =
  mongoose.models.Season ?? mongoose.model<ISeason>("Season", SeasonSchema);

export default Season;
