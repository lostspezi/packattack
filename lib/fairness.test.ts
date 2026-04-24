import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  CLIENT_SEED_PATTERN,
  WEIGHT_SCALE,
  bucketFromHmac,
  canonicalize,
  computePoolHash,
  createFairnessRng,
  createMathRandomRng,
  deriveDrawIndex,
  hmacMessage,
  hmacSha512Hex,
  isValidClientSeed,
  randomHex,
  replayDraws,
  scaleWeight,
  sha256Hex,
  totalWeightOf,
  walkPool,
  type PoolEntry,
} from "./fairness";

const SERVER_SEED = "0".repeat(64);
const CLIENT_SEED = "test-client-seed";

describe("canonicalize", () => {
  it("is deterministic for simple values", () => {
    expect(canonicalize(1)).toBe("1");
    expect(canonicalize("x")).toBe('"x"');
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
  });

  it("treats undefined as null to keep round-trips stable", () => {
    expect(canonicalize(undefined)).toBe("null");
  });

  it("omits object keys whose value is undefined", () => {
    expect(canonicalize({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
  });

  it("sorts object keys alphabetically", () => {
    expect(canonicalize({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  it("produces the same output regardless of key insertion order", () => {
    const a = canonicalize({ a: 1, b: { x: 10, y: 20 } });
    const b = canonicalize({ b: { y: 20, x: 10 }, a: 1 });
    expect(a).toBe(b);
  });

  it("handles nested arrays", () => {
    expect(canonicalize([1, { a: 2 }, [3, 4]])).toBe('[1,{"a":2},[3,4]]');
  });
});

describe("scaleWeight", () => {
  it("scales floats to integers by WEIGHT_SCALE", () => {
    expect(scaleWeight(1)).toBe(WEIGHT_SCALE);
    expect(scaleWeight(0.5)).toBe(WEIGHT_SCALE / 2);
    expect(scaleWeight(0.001)).toBe(1);
  });
});

describe("isValidClientSeed", () => {
  it("accepts 8 to 64 hex/ident chars", () => {
    expect(isValidClientSeed("abcd1234")).toBe(true);
    expect(isValidClientSeed("Ab-c_123_____0123")).toBe(true);
    expect(isValidClientSeed("a".repeat(64))).toBe(true);
  });

  it("rejects too short or too long", () => {
    expect(isValidClientSeed("abcd")).toBe(false);
    expect(isValidClientSeed("a".repeat(65))).toBe(false);
  });

  it("rejects disallowed chars", () => {
    expect(isValidClientSeed("abcd 1234")).toBe(false);
    expect(isValidClientSeed("abcd!1234")).toBe(false);
    expect(isValidClientSeed("abcd:1234")).toBe(false);
  });
});

describe("CLIENT_SEED_PATTERN", () => {
  it("matches the validator", () => {
    expect(CLIENT_SEED_PATTERN.test("abcd1234")).toBe(true);
    expect(CLIENT_SEED_PATTERN.test("abc")).toBe(false);
  });
});

describe("randomHex", () => {
  it("produces 2x hex chars per byte", () => {
    const hex = randomHex(16);
    expect(hex).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  it("returns different values across calls (probabilistic)", () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("matches known vector for empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches known vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("hmacMessage", () => {
  it("uses the locked wire format clientSeed:nonce:poolHash", () => {
    expect(hmacMessage("seed", 3, "abc")).toBe("seed:3:abc");
    expect(hmacMessage("", 0, "")).toBe(":0:");
  });
});

describe("hmacSha512Hex", () => {
  it("matches RFC 4231 test case 1", async () => {
    // key = 20 bytes of 0x0b, msg = "Hi There"
    const key = "0b".repeat(20);
    const msg = "Hi There";
    const expected =
      "87aa7cdea5ef619d4ff0b4241a1d6cb0" +
      "2379f4e2ce4ec2787ad0b30545e17cde" +
      "daa833b7d6b8a702038b274eaea3f4e4" +
      "be9d914eeb61f1702e696c203a126854";
    expect(await hmacSha512Hex(key, msg)).toBe(expected);
  });

  it("is deterministic for the same inputs", async () => {
    const a = await hmacSha512Hex(SERVER_SEED, "msg1");
    const b = await hmacSha512Hex(SERVER_SEED, "msg1");
    expect(a).toBe(b);
  });

  it("differs when message differs", async () => {
    const a = await hmacSha512Hex(SERVER_SEED, "msg1");
    const b = await hmacSha512Hex(SERVER_SEED, "msg2");
    expect(a).not.toBe(b);
  });

  it("matches node:crypto createHmac byte-for-byte (cross-check)", async () => {
    // Independent reference implementation. If the Web Crypto wrapper ever
    // drifts — e.g. different endianness, encoding, or a subtle bug in the
    // hex conversion — this test catches it.
    const cases: Array<{ key: string; msg: string }> = [
      { key: SERVER_SEED, msg: "clientSeed:0:0000" },
      { key: SERVER_SEED, msg: hmacMessage(CLIENT_SEED, 42, "deadbeef") },
      { key: "ab".repeat(32), msg: "arbitrary message with spaces" },
      { key: "f".repeat(64), msg: hmacMessage("lucky", 9999, "cafebabe") },
    ];

    for (const { key, msg } of cases) {
      const ours = await hmacSha512Hex(key, msg);
      const theirs = createHmac("sha512", Buffer.from(key, "hex"))
        .update(msg, "utf8")
        .digest("hex");
      expect(ours).toBe(theirs);
    }
  });
});

describe("bucketFromHmac", () => {
  it("reduces first 8 bytes mod totalWeight", () => {
    // first 8 bytes = 0xffffffffffffffff
    const hmac = "f".repeat(16) + "00".repeat(56);
    const tw = BigInt(100);
    const maxU64 = BigInt("0xffffffffffffffff");
    expect(bucketFromHmac(hmac, tw)).toBe(maxU64 % BigInt(100));
  });

  it("throws on zero totalWeight", () => {
    expect(() => bucketFromHmac("0".repeat(128), BigInt(0))).toThrow();
  });

  it("always returns a value in [0, totalWeight)", () => {
    const hmac = "a".repeat(128);
    const bucket = bucketFromHmac(hmac, BigInt(1000));
    expect(bucket >= BigInt(0)).toBe(true);
    expect(bucket < BigInt(1000)).toBe(true);
  });

  it("ignores bytes beyond the first 8", () => {
    // Same first 16 hex chars, different tail — bucket must be equal.
    const a = "0123456789abcdef" + "00".repeat(56);
    const b = "0123456789abcdef" + "ff".repeat(56);
    expect(bucketFromHmac(a, BigInt(999_999))).toBe(bucketFromHmac(b, BigInt(999_999)));
  });

  it("locks known-value buckets", () => {
    // Golden values — u64 = 0x0000000000000010 (decimal 16):
    const hmac16 = "0000000000000010" + "00".repeat(56);
    expect(bucketFromHmac(hmac16, BigInt(7))).toBe(BigInt(16 % 7));
    expect(bucketFromHmac(hmac16, BigInt(3))).toBe(BigInt(16 % 3));
    expect(bucketFromHmac(hmac16, BigInt(1))).toBe(BigInt(0));
    // u64 = 0x000000000000000e (decimal 14)
    const hmac14 = "000000000000000e" + "00".repeat(56);
    expect(bucketFromHmac(hmac14, BigInt(7))).toBe(BigInt(14 % 7));
  });
});

describe("walkPool", () => {
  const pool: PoolEntry[] = [
    { cardId: "a", weight: 10, stock: 1 },
    { cardId: "b", weight: 20, stock: 1 },
    { cardId: "c", weight: 30, stock: 1 },
  ];
  // cumulative = [10, 30, 60]

  it("picks the first card when bucket < first weight", () => {
    expect(walkPool(pool, BigInt(0))).toBe(0);
    expect(walkPool(pool, BigInt(9))).toBe(0);
  });

  it("picks the second card at the boundary", () => {
    expect(walkPool(pool, BigInt(10))).toBe(1);
    expect(walkPool(pool, BigInt(29))).toBe(1);
  });

  it("picks the third card at the upper boundary", () => {
    expect(walkPool(pool, BigInt(30))).toBe(2);
    expect(walkPool(pool, BigInt(59))).toBe(2);
  });

  it("falls back to last index when bucket >= totalWeight (defensive)", () => {
    expect(walkPool(pool, BigInt(60))).toBe(2);
    expect(walkPool(pool, BigInt(1000))).toBe(2);
  });
});

describe("totalWeightOf", () => {
  it("sums weights as BigInt", () => {
    const pool: PoolEntry[] = [
      { cardId: "a", weight: 10, stock: 1 },
      { cardId: "b", weight: 20, stock: 1 },
    ];
    expect(totalWeightOf(pool)).toBe(BigInt(30));
  });
});

describe("computePoolHash", () => {
  it("is deterministic for the same pool", async () => {
    const pool: PoolEntry[] = [
      { cardId: "a", weight: 10, stock: 5 },
      { cardId: "b", weight: 20, stock: 5 },
    ];
    const a = await computePoolHash(pool);
    const b = await computePoolHash(pool);
    expect(a).toBe(b);
  });

  it("differs for different pools", async () => {
    const a: PoolEntry[] = [{ cardId: "a", weight: 10, stock: 5 }];
    const b: PoolEntry[] = [{ cardId: "b", weight: 10, stock: 5 }];
    expect(await computePoolHash(a)).not.toBe(await computePoolHash(b));
  });

  it("is insensitive to PoolEntry key insertion order (canonical hash)", async () => {
    const natural: PoolEntry = { cardId: "a", weight: 10, stock: 5 };
    // Construct an entry with the same values but different insertion order.
    const reordered = { stock: 5, weight: 10, cardId: "a" } as PoolEntry;
    expect(await computePoolHash([natural])).toBe(await computePoolHash([reordered]));
  });

  it("stores stock under the stockAtOpen key — contract test", async () => {
    // If the internal re-mapping ever drops the stock rename, a verifier
    // reading commitments from the DB would compute a different hash.
    const pool: PoolEntry[] = [{ cardId: "a", weight: 10, stock: 3 }];
    const hash = await computePoolHash(pool);
    const manual = await sha256Hex(
      canonicalize([{ cardId: "a", stockAtOpen: 3, weight: 10 }]),
    );
    expect(hash).toBe(manual);
  });
});

describe("deriveDrawIndex", () => {
  const pool: PoolEntry[] = [
    { cardId: "a", weight: 1, stock: 1 },
    { cardId: "b", weight: 1, stock: 1 },
    { cardId: "c", weight: 1, stock: 1 },
  ];

  it("returns a valid index for each nonce", async () => {
    for (let nonce = 0; nonce < 20; nonce++) {
      const { index } = await deriveDrawIndex({
        serverSeed: SERVER_SEED,
        clientSeed: CLIENT_SEED,
        nonce,
        poolHash: "deadbeef",
        pool,
      });
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(pool.length);
    }
  });

  it("is deterministic for the same inputs", async () => {
    const a = await deriveDrawIndex({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce: 7,
      poolHash: "ffffffff",
      pool,
    });
    const b = await deriveDrawIndex({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce: 7,
      poolHash: "ffffffff",
      pool,
    });
    expect(a.index).toBe(b.index);
    expect(a.hmacHex).toBe(b.hmacHex);
    expect(a.bucket).toBe(b.bucket);
  });
});

describe("replayDraws", () => {
  it("produces the same outcome each time it runs", async () => {
    const snapshot: PoolEntry[] = [
      { cardId: "a", weight: scaleWeight(1), stock: 3 },
      { cardId: "b", weight: scaleWeight(1), stock: 3 },
      { cardId: "c", weight: scaleWeight(1), stock: 3 },
    ];
    const poolHash = await computePoolHash(snapshot);

    const first = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      nonceEnd: 5,
      poolHash,
      poolSnapshot: snapshot,
    });
    const second = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      nonceEnd: 5,
      poolHash,
      poolSnapshot: snapshot,
    });

    expect(first.map((x) => x.cardId)).toEqual(second.map((x) => x.cardId));
    expect(first).toHaveLength(5);
  });

  it("respects stock depletion and falls back to remaining cards", async () => {
    const snapshot: PoolEntry[] = [
      { cardId: "only-one", weight: scaleWeight(1), stock: 1 },
      { cardId: "unlimited", weight: scaleWeight(1), stock: 100 },
    ];
    const poolHash = await computePoolHash(snapshot);

    const outcomes = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      nonceEnd: 10,
      poolHash,
      poolSnapshot: snapshot,
    });

    const onlyOneCount = outcomes.filter((o) => o.cardId === "only-one").length;
    expect(onlyOneCount).toBeLessThanOrEqual(1);
  });

  it("stops early when the pool is fully depleted", async () => {
    const snapshot: PoolEntry[] = [{ cardId: "a", weight: scaleWeight(1), stock: 2 }];
    const poolHash = await computePoolHash(snapshot);

    const outcomes = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      nonceEnd: 10,
      poolHash,
      poolSnapshot: snapshot,
    });

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.cardId === "a")).toBe(true);
  });

  it("returns exactly one outcome for a single card with stock 1 and many nonces requested", async () => {
    const snapshot: PoolEntry[] = [{ cardId: "single", weight: scaleWeight(1), stock: 1 }];
    const poolHash = await computePoolHash(snapshot);

    const outcomes = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      nonceEnd: 5,
      poolHash,
      poolSnapshot: snapshot,
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].cardId).toBe("single");
  });

  it("starts at nonceStart and stamps contiguous nonces onto every outcome", async () => {
    // Regression guard: a nonce-shift bug (e.g. off-by-one) would change the
    // first outcome's nonce value even though per-draw determinism holds.
    const snapshot: PoolEntry[] = [
      { cardId: "a", weight: scaleWeight(1), stock: 10 },
      { cardId: "b", weight: scaleWeight(1), stock: 10 },
    ];
    const poolHash = await computePoolHash(snapshot);

    const outcomes = await replayDraws({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 42,
      nonceEnd: 45,
      poolHash,
      poolSnapshot: snapshot,
    });

    expect(outcomes.map((o) => o.nonce)).toEqual([42, 43, 44]);
  });
});

describe("createFairnessRng", () => {
  it("advances nonce between calls, producing different buckets", async () => {
    const rng = createFairnessRng({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 0,
      poolHash: "abcd",
    });

    const tw = BigInt(1_000_000_000);
    const first = await rng(tw);
    const second = await rng(tw);
    // Statistically almost impossible for two different nonces to collide
    // at this range.
    expect(first).not.toBe(second);
  });

  it("matches what replayDraws would compute for the same pool", async () => {
    const pool: PoolEntry[] = [
      { cardId: "a", weight: scaleWeight(1), stock: 100 },
      { cardId: "b", weight: scaleWeight(2), stock: 100 },
    ];
    const poolHash = await computePoolHash(pool);

    const rng = createFairnessRng({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonceStart: 5,
      poolHash,
    });

    const totalWeight = totalWeightOf(pool);
    const rngBucket = await rng(totalWeight);

    const { bucket } = await deriveDrawIndex({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce: 5,
      poolHash,
      pool,
    });

    expect(rngBucket).toBe(bucket);
  });
});

describe("createMathRandomRng", () => {
  it("returns a bucket in [0, totalWeight)", async () => {
    const rng = createMathRandomRng();
    const tw = BigInt(100);
    for (let i = 0; i < 100; i++) {
      const bucket = await rng(tw);
      expect(bucket >= BigInt(0)).toBe(true);
      expect(bucket < tw).toBe(true);
    }
  });

  it("throws if totalWeight exceeds safe-int range", async () => {
    const rng = createMathRandomRng();
    const tooBig = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
    await expect(rng(tooBig)).rejects.toThrow();
  });
});
