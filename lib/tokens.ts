import crypto from "crypto";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import VerificationToken from "@/models/verification-token";

type TokenType = "email_verify" | "pwd_reset";

const TTL: Record<TokenType, number> = {
  email_verify: 24 * 60 * 60 * 1000,
  pwd_reset: 60 * 60 * 1000,
};

export async function generateVerificationToken(
  userId: string,
  type: TokenType
): Promise<string> {
  await connectDB();

  // Delete existing tokens of the same type for this user
  await VerificationToken.deleteMany({ userId, type });

  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = await bcrypt.hash(raw, 10);
  const expires = new Date(Date.now() + TTL[type]);

  await VerificationToken.create({
    userId,
    token: hashed,
    type,
    expires,
  });

  return raw;
}

export async function verifyToken(
  raw: string,
  type: TokenType
): Promise<string | null> {
  await connectDB();

  const now = new Date();
  const candidates = await VerificationToken.find({
    type,
    expires: { $gt: now },
  });

  for (const candidate of candidates) {
    const match = await bcrypt.compare(raw, candidate.token);
    if (match) {
      await VerificationToken.deleteOne({ _id: candidate._id });
      return candidate.userId.toString();
    }
  }

  return null;
}
