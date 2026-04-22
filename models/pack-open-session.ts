import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * Mutex for pack-opening: at most one active session per user, enforced by a
 * unique index on `userId`. A dedicated collection avoids collisions with the
 * per-card PackPull batch insert (a partial unique on
 * `PackPull{userId, status:"pending"}` would block that batch). A TTL on
 * `expiresAt` cleans sessions up if the client never hits /pulls/decide.
 */
export interface IPackOpenSession extends Document {
  userId: Types.ObjectId;
  boxId: Types.ObjectId;
  packGroupId: string;
  expiresAt: Date;
  createdAt: Date;
}

const PackOpenSessionSchema = new Schema<IPackOpenSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    boxId: { type: Schema.Types.ObjectId, ref: "Box", required: true },
    packGroupId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Automatically reap sessions whose client never decided their pulls.
PackOpenSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PackOpenSession: Model<IPackOpenSession> =
  mongoose.models.PackOpenSession ??
  mongoose.model<IPackOpenSession>("PackOpenSession", PackOpenSessionSchema);

export default PackOpenSession;
