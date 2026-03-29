import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IBattleRoundCard {
  player: Types.ObjectId;
  card: Types.ObjectId;
  rarity: string;
  coinValue: number;
}

export interface IBattleRound {
  roundIndex: number;
  cards: IBattleRoundCard[];
  winnerId: Types.ObjectId | null;
  revealedAt: Date | null;
}

export interface IBattlePlayer {
  user: Types.ObjectId;
  joinedAt: Date;
  coinsReserved: number;
  eloAtStart: number;
  score: number;
  placement: number | null;
  eloChange: number | null;
  ready: boolean;
}

export interface IBattle extends Document {
  slug: string;
  createdBy: Types.ObjectId;
  box: Types.ObjectId;
  packsPerPlayer: number;
  maxPlayers: number;
  status: "waiting" | "ready_check" | "countdown" | "opening" | "clash" | "finished" | "cancelled";
  visibility: "public" | "private";
  minElo: number | null;
  players: IBattlePlayer[];
  rounds: IBattleRound[];
  currentRound: number;
  totalRounds: number;
  readyCheckStartedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  seasonId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BattleRoundCardSchema = new Schema<IBattleRoundCard>(
  {
    player: { type: Schema.Types.ObjectId, ref: "User", required: true },
    card: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
  },
  { _id: false }
);

const BattleRoundSchema = new Schema<IBattleRound>(
  {
    roundIndex: { type: Number, required: true },
    cards: { type: [BattleRoundCardSchema], default: [] },
    winnerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revealedAt: { type: Date, default: null },
  },
  { _id: false }
);

const BattlePlayerSchema = new Schema<IBattlePlayer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    coinsReserved: { type: Number, required: true },
    eloAtStart: { type: Number, required: true },
    score: { type: Number, default: 0 },
    placement: { type: Number, default: null },
    eloChange: { type: Number, default: null },
    ready: { type: Boolean, default: false },
  },
  { _id: false }
);

const BattleSchema = new Schema<IBattle>(
  {
    slug: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    box: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    packsPerPlayer: { type: Number, required: true, min: 1, max: 10 },
    maxPlayers: { type: Number, required: true, min: 2 },
    status: {
      type: String,
      enum: ["waiting", "ready_check", "countdown", "opening", "clash", "finished", "cancelled"],
      default: "waiting",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    minElo: { type: Number, default: null },
    players: { type: [BattlePlayerSchema], default: [] },
    rounds: { type: [BattleRoundSchema], default: [] },
    currentRound: { type: Number, default: 0 },
    totalRounds: { type: Number, required: true },
    readyCheckStartedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", default: null },
  },
  { timestamps: true }
);

BattleSchema.index({ status: 1, visibility: 1 });
BattleSchema.index({ "players.user": 1, status: 1 });
BattleSchema.index({ createdBy: 1 });
BattleSchema.index({ seasonId: 1, finishedAt: -1 });

const Battle: Model<IBattle> =
  mongoose.models.Battle ?? mongoose.model<IBattle>("Battle", BattleSchema);

export default Battle;
