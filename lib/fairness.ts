/**
 * Isomorphic fairness primitives. The same module runs server-side (Node 20+)
 * during pack-opening and client-side in the verifier — users replay their
 * rolls with exactly this code, so any server/client drift would break the
 * verification contract.
 *
 * Relies on globalThis.crypto (Web Crypto API + getRandomValues), which is
 * available in Node 19+ and all modern browsers.
 *
 * Box weights in the database are floats with up to 3 decimal places
 * (min 0.001, max 1000). For deterministic BigInt bucket math we scale every
 * weight by WEIGHT_SCALE at snapshot time and store the integer form. Any
 * replay must use the same scaling.
 */

export const WEIGHT_SCALE = 1000;

export const CLIENT_SEED_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export interface PoolEntry {
  cardId: string;
  weight: number; // integer, already multiplied by WEIGHT_SCALE
  stock: number;
}

export interface DrawOutcome {
  nonce: number;
  cardId: string;
  bucket: bigint;
  totalWeight: bigint;
  hmacHex: string;
}

export interface ReplayArgs {
  serverSeed: string;
  clientSeed: string;
  nonceStart: number;
  nonceEnd: number;
  poolHash: string;
  poolSnapshot: PoolEntry[];
}

export function scaleWeight(floatWeight: number): number {
  return Math.round(floatWeight * WEIGHT_SCALE);
}

export function isValidClientSeed(seed: string): boolean {
  return CLIENT_SEED_PATTERN.test(seed);
}

export function canonicalize(value: unknown): string {
  if (value === undefined) {
    // Matches JSON.stringify(undefined) inside an array (becomes null) or at
    // top level (returns undefined). Here we pick "null" so round-tripping
    // through JSON.parse + canonicalize stays stable.
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  // Keys whose value is undefined are skipped, matching JSON.stringify of
  // objects. This keeps the canonical form identical whether the source is
  // a Mongoose document or a JSON-parsed snapshot.
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") +
    "}"
  );
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd-length hex string");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const textEncoder = new TextEncoder();

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API unavailable (requires Node 19+ or modern browser)");
  }
  return c.subtle;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", textEncoder.encode(input));
  return toHex(new Uint8Array(digest));
}

export async function hmacSha512Hex(keyHex: string, message: string): Promise<string> {
  const keyBytes = fromHex(keyHex);
  const key = await subtle().importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await subtle().sign("HMAC", key, textEncoder.encode(message));
  return toHex(new Uint8Array(sig));
}

export function randomHex(byteCount: number): string {
  const c = globalThis.crypto;
  if (!c) throw new Error("Web Crypto unavailable");
  const bytes = new Uint8Array(byteCount);
  c.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Canonical pool hash: feeds per-open entropy into the HMAC message so two
 * different boxes produce different rolls even at the same nonce, and so
 * admins can't silently swap a pool between commitment and verify.
 */
export async function computePoolHash(pool: PoolEntry[]): Promise<string> {
  const normalized = pool.map((e) => ({
    cardId: e.cardId,
    stockAtOpen: e.stock,
    weight: e.weight,
  }));
  return sha256Hex(canonicalize(normalized));
}

export function hmacMessage(clientSeed: string, nonce: number, poolHash: string): string {
  return `${clientSeed}:${nonce}:${poolHash}`;
}

export function bucketFromHmac(hmacHex: string, totalWeight: bigint): bigint {
  if (totalWeight <= BigInt(0)) throw new Error("totalWeight must be positive");
  const u64 = BigInt("0x" + hmacHex.slice(0, 16));
  return u64 % totalWeight;
}

/**
 * Walk cumulative weights and return the index whose range contains `bucket`.
 * Uses "first cumulative > bucket" — matches integer bucket semantics and is
 * the shared contract between pack-engine and verifier.
 *
 * Ordering contract: the pool passed to this function is the live (stock > 0)
 * subset for the current draw, kept in the same order as the commitment
 * poolSnapshot. Server-side pack-engine and client-side verifier must both
 * filter-and-order identically or the replay diverges.
 */
export function walkPool(pool: PoolEntry[], bucket: bigint): number {
  let cumulative = BigInt(0);
  for (let i = 0; i < pool.length; i++) {
    cumulative += BigInt(pool[i].weight);
    if (cumulative > bucket) return i;
  }
  return pool.length - 1;
}

export function totalWeightOf(pool: PoolEntry[]): bigint {
  let total = BigInt(0);
  for (const e of pool) total += BigInt(e.weight);
  return total;
}

export async function deriveDrawIndex(args: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  poolHash: string;
  pool: PoolEntry[];
}): Promise<{ index: number; hmacHex: string; bucket: bigint; totalWeight: bigint }> {
  const totalWeight = totalWeightOf(args.pool);
  const hmacHex = await hmacSha512Hex(
    args.serverSeed,
    hmacMessage(args.clientSeed, args.nonce, args.poolHash),
  );
  const bucket = bucketFromHmac(hmacHex, totalWeight);
  const index = walkPool(args.pool, bucket);
  return { index, hmacHex, bucket, totalWeight };
}

/**
 * Replay the full commitment: for each nonce in [nonceStart, nonceEnd), run
 * HMAC → bucket → pool-walk → decrement stock. Returns ordered outcomes that
 * must byte-match the PackPull records created at open time.
 */
export async function replayDraws(args: ReplayArgs): Promise<DrawOutcome[]> {
  const stockLeft = new Map<string, number>();
  for (const e of args.poolSnapshot) stockLeft.set(e.cardId, e.stock);

  const out: DrawOutcome[] = [];

  for (let nonce = args.nonceStart; nonce < args.nonceEnd; nonce++) {
    const available: PoolEntry[] = [];
    for (const e of args.poolSnapshot) {
      const rem = stockLeft.get(e.cardId) ?? 0;
      if (rem > 0) available.push({ cardId: e.cardId, weight: e.weight, stock: rem });
    }
    if (available.length === 0) break;

    const drawn = await deriveDrawIndex({
      serverSeed: args.serverSeed,
      clientSeed: args.clientSeed,
      nonce,
      poolHash: args.poolHash,
      pool: available,
    });

    const picked = available[drawn.index];
    stockLeft.set(picked.cardId, (stockLeft.get(picked.cardId) ?? 1) - 1);

    out.push({
      nonce,
      cardId: picked.cardId,
      bucket: drawn.bucket,
      totalWeight: drawn.totalWeight,
      hmacHex: drawn.hmacHex,
    });
  }

  return out;
}

/**
 * RNG step used by pack-engine. Given the current total weight, returns a
 * BigInt bucket index in [0, totalWeight). Pack-engine then walks its own
 * pool with walkPool to pick a card.
 */
export type RngStep = (totalWeight: bigint) => Promise<bigint>;

/**
 * HMAC-backed RNG factory. Each call advances the nonce by one so successive
 * draws in the same opening get distinct HMAC messages. Caller must ensure
 * the nonce window matches what was reserved in the FairnessSeed doc.
 */
export function createFairnessRng(args: {
  serverSeed: string;
  clientSeed: string;
  nonceStart: number;
  poolHash: string;
}): RngStep {
  let nonce = args.nonceStart;
  return async (totalWeight: bigint) => {
    const hmacHex = await hmacSha512Hex(
      args.serverSeed,
      hmacMessage(args.clientSeed, nonce, args.poolHash),
    );
    nonce++;
    return bucketFromHmac(hmacHex, totalWeight);
  };
}

/**
 * Math.random()-based RNG, used by the battle hand path. Kept here so the
 * walk-pool contract is shared across every draw-site in the codebase.
 */
export function createMathRandomRng(): RngStep {
  return async (totalWeight: bigint) => {
    const tw = Number(totalWeight);
    return BigInt(Math.floor(Math.random() * tw));
  };
}
