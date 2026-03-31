import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ---------- Sub-interfaces ----------

export interface IVirtualCard {
  cardId: Types.ObjectId;
  name: string;
  image: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  pullId: Types.ObjectId | null;
}

export interface IBattleHand {
  player: Types.ObjectId;
  cards: IVirtualCard[];
  selectedCardIndex: number | null;
  selectedAt: Date | null;
}

export interface IBattleRound {
  roundNumber: number;
  hands: IBattleHand[];
  winner: Types.ObjectId | null;
  status: "selecting" | "revealing" | "completed";
  selectDeadline: Date | null;
  revealedAt: Date | null;
}

export interface IBattlePlayer {
  user: Types.ObjectId;
  joinedAt: Date;
  isReady: boolean;
  readyAt: Date | null;
  roundsWon: number;
}

export interface IBattleTransfer {
  from: Types.ObjectId;
  to: Types.ObjectId;
  cards: IVirtualCard[];
  mode: string;
}

export interface IBattleEloChange {
  player: Types.ObjectId;
  oldElo: number;
  newElo: number;
  change: number;
}

export interface IBattleResult {
  winner: Types.ObjectId | null;
  isDraw: boolean;
  finalScores: { player: Types.ObjectId; roundsWon: number }[];
  transfers: IBattleTransfer[];
  eloChanges: IBattleEloChange[];
  completedAt: Date;
}

export type BattleMode = "lowest_card" | "highest_card" | "all_cards" | "snake_draft";
export type BattleStatus = "waiting" | "ready_check" | "countdown" | "active" | "sudden_death" | "finished" | "cancelled";

export interface IBattleSettings {
  playerCount: 2 | 3 | 4;
  rounds: 3 | 5 | 7;
  mode: BattleMode;
  isPrivate: boolean;
  inviteCode: string | null;
}

export interface IBattle extends Document {
  slug: string;
  creator: Types.ObjectId;
  box: Types.ObjectId;
  players: IBattlePlayer[];
  settings: IBattleSettings;
  entryFee: number;
  status: BattleStatus;
  currentRound: number;
  lobbyExpiresAt: Date;
  readyCheckExpiresAt: Date | null;
  startCountdownAt: Date | null;
  rounds: IBattleRound[];
  result: IBattleResult | null;
  seasonId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Schemas ----------

const VirtualCardSchema = new Schema<IVirtualCard>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    rarity: { type: String, required: true },
    coinValue: { type: Number, required: true },
    conversionValue: { type: Number, default: 0 },
    pullId: { type: Schema.Types.ObjectId, ref: "PackPull", default: null },
  },
  { _id: false },
);

const BattleHandSchema = new Schema<IBattleHand>(
  {
    player: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cards: { type: [VirtualCardSchema], required: true },
    selectedCardIndex: { type: Number, default: null },
    selectedAt: { type: Date, default: null },
  },
  { _id: false },
);

const BattleRoundSchema = new Schema<IBattleRound>(
  {
    roundNumber: { type: Number, required: true },
    hands: { type: [BattleHandSchema], required: true },
    winner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["selecting", "revealing", "completed"],
      default: "selecting",
    },
    selectDeadline: { type: Date, default: null },
    revealedAt: { type: Date, default: null },
  },
  { _id: false },
);

const BattlePlayerSchema = new Schema<IBattlePlayer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    isReady: { type: Boolean, default: false },
    readyAt: { type: Date, default: null },
    roundsWon: { type: Number, default: 0 },
  },
  { _id: false },
);

const BattleTransferSchema = new Schema<IBattleTransfer>(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cards: { type: [VirtualCardSchema], required: true },
    mode: { type: String, required: true },
  },
  { _id: false },
);

const BattleEloChangeSchema = new Schema<IBattleEloChange>(
  {
    player: { type: Schema.Types.ObjectId, ref: "User", required: true },
    oldElo: { type: Number, required: true },
    newElo: { type: Number, required: true },
    change: { type: Number, required: true },
  },
  { _id: false },
);

const BattleResultSchema = new Schema<IBattleResult>(
  {
    winner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDraw: { type: Boolean, default: false },
    finalScores: [
      {
        player: { type: Schema.Types.ObjectId, ref: "User", required: true },
        roundsWon: { type: Number, required: true },
        _id: false,
      },
    ],
    transfers: { type: [BattleTransferSchema], default: [] },
    eloChanges: { type: [BattleEloChangeSchema], default: [] },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const BattleSchema = new Schema<IBattle>(
  {
    slug: { type: String, unique: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    box: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    players: { type: [BattlePlayerSchema], default: [] },
    settings: {
      playerCount: { type: Number, enum: [2, 3, 4], required: true },
      rounds: { type: Number, enum: [3, 5, 7], required: true },
      mode: {
        type: String,
        enum: ["lowest_card", "highest_card", "all_cards", "snake_draft"],
        required: true,
      },
      isPrivate: { type: Boolean, default: false },
      inviteCode: { type: String, default: null },
    },
    entryFee: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["waiting", "ready_check", "countdown", "active", "sudden_death", "finished", "cancelled"],
      default: "waiting",
    },
    currentRound: { type: Number, default: 0 },
    lobbyExpiresAt: { type: Date, required: true },
    readyCheckExpiresAt: { type: Date, default: null },
    startCountdownAt: { type: Date, default: null },
    rounds: { type: [BattleRoundSchema], default: [] },
    result: { type: BattleResultSchema, default: null },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", default: null },
  },
  { timestamps: true },
);

// Auto-generate slug
BattleSchema.pre("save", async function () {
  if (this.slug) return;

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug: string;
  const BattleModel = this.constructor as Model<IBattle>;

   
  while (true) {
    slug = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const existing = await BattleModel.findOne({ slug }).select("_id").lean();
    if (!existing) break;
  }

  this.slug = slug;
});

BattleSchema.index({ slug: 1 }, { unique: true });
BattleSchema.index({ status: 1, lobbyExpiresAt: 1 });
BattleSchema.index({ "players.user": 1, status: 1 });
BattleSchema.index({ seasonId: 1, status: 1 });
BattleSchema.index({ createdAt: -1 });

const Battle: Model<IBattle> =
  mongoose.models.Battle ?? mongoose.model<IBattle>("Battle", BattleSchema);

export default Battle;
