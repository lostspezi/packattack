"use client";

import { useState } from "react";
import {
  bucketFromHmac,
  computePoolHash,
  hmacSha512Hex,
  hmacMessage,
  type PoolEntry,
} from "@/lib/fairness";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Standalone admin/power-user verifier: user pastes serverSeed, clientSeed,
 * nonce, poolHash + optional pool JSON and sees every intermediate step of
 * the HMAC-SHA512 → bucket pipeline. No commitment lookup, fully offline.
 */
export default function FreeformVerifier() {
  const [serverSeed, setServerSeed] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("0");
  const [poolHash, setPoolHash] = useState("");
  const [poolJson, setPoolJson] = useState("");
  const [status, setStatus] = useState<"idle" | "computing" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    hmacHex: string;
    bucket: string;
    totalWeight: string;
    cardIndex: number | null;
    cardId: string | null;
    recomputedPoolHash: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("computing");
    setError(null);
    setResult(null);
    try {
      let pool: PoolEntry[] | null = null;
      if (poolJson.trim()) {
        try {
          const parsed = JSON.parse(poolJson);
          if (!Array.isArray(parsed)) throw new Error("pool must be an array");
          pool = parsed.map((e: Record<string, unknown>) => ({
            cardId: String(e.cardId),
            weight: Number(e.weight),
            stock: Number(e.stock ?? e.stockAtOpen ?? 0),
          }));
        } catch (err) {
          throw new Error("Pool JSON ungültig: " + (err instanceof Error ? err.message : String(err)));
        }
      }

      const n = parseInt(nonce, 10);
      if (!Number.isFinite(n) || n < 0) throw new Error("Nonce muss eine nicht-negative Zahl sein.");

      // Prefer the provided pool's derived hash so admins can double-check
      // that "this pool yields this hash" — falls back to manual hash.
      const effectivePoolHash = pool ? await computePoolHash(pool) : poolHash.trim();
      if (!effectivePoolHash) {
        throw new Error("Entweder Pool-Hash oder Pool-JSON angeben.");
      }

      const hmac = await hmacSha512Hex(
        serverSeed.trim(),
        hmacMessage(clientSeed.trim(), n, effectivePoolHash),
      );

      const totalWeight = pool
        ? pool.reduce((acc, e) => acc + BigInt(e.weight), BigInt(0))
        : null;

      let bucket: bigint | null = null;
      let cardIndex: number | null = null;
      let cardId: string | null = null;
      if (pool) {
        if (!totalWeight || totalWeight <= BigInt(0)) {
          // Without positive weight there's no selection to make. Surface
          // this as an error instead of rendering an empty result row —
          // silent failures defeat the point of an investigative tool.
          throw new Error(
            "Alle Pool-Gewichte sind 0 — keine Auswahl möglich. Prüf die JSON-Eingabe.",
          );
        }
        bucket = bucketFromHmac(hmac, totalWeight);
        let cumulative = BigInt(0);
        for (let i = 0; i < pool.length; i++) {
          cumulative += BigInt(pool[i].weight);
          if (cumulative > bucket) {
            cardIndex = i;
            cardId = pool[i].cardId;
            break;
          }
        }
      }

      setResult({
        hmacHex: hmac,
        bucket: bucket?.toString() ?? "—",
        totalWeight: totalWeight?.toString() ?? "—",
        cardIndex,
        cardId,
        recomputedPoolHash: pool ? effectivePoolHash : null,
      });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-4">Freeform-Eingabe</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Server Seed (64 hex)</span>
            <input
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Client Seed</span>
            <input
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Nonce</span>
            <input
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm w-40"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">
              Pool-Hash (falls Pool unten leer bleibt)
            </span>
            <input
              value={poolHash}
              onChange={(e) => setPoolHash(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">
              Pool-JSON (optional) — [{`{ cardId, weight, stock }`}, …]
            </span>
            <textarea
              value={poolJson}
              onChange={(e) => setPoolJson(e.target.value)}
              rows={6}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-xs"
              spellCheck={false}
            />
          </label>
          <div>
            <Button onClick={run} loading={status === "computing"}>
              Rechnen
            </Button>
          </div>
          {error && <p className="text-error-light text-sm">{error}</p>}
        </div>
      </Card>

      {result && (
        <Card variant="topline" className="p-6">
          <h2 className="text-xl font-bold mb-4">Ergebnis</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-secondary">HMAC-SHA512</dt>
            <dd className="font-mono break-all">{result.hmacHex}</dd>

            {result.recomputedPoolHash && (
              <>
                <dt className="text-text-secondary">Pool-Hash (aus Pool)</dt>
                <dd className="font-mono break-all">{result.recomputedPoolHash}</dd>
              </>
            )}

            <dt className="text-text-secondary">Bucket</dt>
            <dd className="font-mono">{result.bucket}</dd>

            <dt className="text-text-secondary">Total Weight</dt>
            <dd className="font-mono">{result.totalWeight}</dd>

            {result.cardIndex !== null && (
              <>
                <dt className="text-text-secondary">Picked Index</dt>
                <dd className="font-mono">{result.cardIndex}</dd>
                <dt className="text-text-secondary">Picked Card ID</dt>
                <dd className="font-mono break-all">{result.cardId}</dd>
              </>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}
