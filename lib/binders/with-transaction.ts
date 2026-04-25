import mongoose, { type ClientSession } from "mongoose";

/**
 * Run `fn` inside a Mongoose transaction. When the underlying MongoDB
 * deployment does not support transactions (standalone, no replica set —
 * common in local dev), the helper transparently retries `fn` once without
 * a session, so callers get atomic semantics in production and best-effort
 * sequential semantics in dev.
 *
 * Calls to `fn` MUST forward the session to every Mongoose operation that
 * should join the transaction (model methods take `{ session }`, documents
 * take `doc.save({ session })` or `doc.deleteOne({ session })`).
 */
export async function withTxnOrSequential<T>(
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let captured: T | undefined;
    let captured$ = false;
    try {
      await session.withTransaction(async () => {
        captured = await fn(session);
        captured$ = true;
      });
      if (!captured$) {
        throw new Error("transaction body did not run");
      }
      return captured as T;
    } catch (err) {
      if (isTransactionUnsupported(err)) {
        return await fn(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

function isTransactionUnsupported(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: number;
    codeName?: string;
    message?: string;
    errorLabels?: string[];
  };
  if (
    e.codeName === "IllegalOperation" ||
    e.codeName === "NotImplemented" ||
    e.code === 20
  ) {
    return true;
  }
  const msg = e.message ?? "";
  return (
    msg.includes("replica set") ||
    msg.includes("Transactions are not supported") ||
    msg.includes("only supported on replica set")
  );
}
