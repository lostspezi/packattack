"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePoolHash,
  replayDraws,
  type DrawOutcome,
  type PoolEntry,
} from "@/lib/fairness";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface VerifierPoolEntry {
  cardId: string;
  cardName: string;
  cardImage: string | null;
  weight: number;
  stockAtOpen: number;
}

export interface VerifierPull {
  id: string;
  cardId: string;
  cardName: string;
  cardImage: string | null;
  rarity: string;
  coinValue: number;
  nonce: number | null;
}

export interface VerifierCommitment {
  id: string;
  packGroupId: string;
  boxId: string;
  boxName: { de?: string; en?: string } | null;
  clientSeed: string;
  nonceStart: number;
  nonceEnd: number;
  poolHash: string;
  serverSeedHashAtOpen: string;
  poolSnapshot: VerifierPoolEntry[];
  createdAt: string;
}

export interface VerifierSeed {
  id: string;
  status: "active" | "revealed";
  serverSeedHash: string;
  serverSeed: string | null;
  activatedAt: string;
  revealedAt: string | null;
}

interface VerifierProps {
  commitment: VerifierCommitment;
  seed: VerifierSeed;
  pulls: VerifierPull[];
}

type MatchState = "match" | "mismatch" | "no_record";

interface RowResult {
  nonce: number;
  expectedCardId: string | null;
  computedCardId: string;
  state: MatchState;
  hmacHex: string;
  bucket: string;
  totalWeight: string;
}

export default function Verifier({ commitment, seed, pulls }: VerifierProps) {
  const [manualServerSeed, setManualServerSeed] = useState((seed.serverSeed ?? "").trim());
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [results, setResults] = useState<RowResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [poolHashCheck, setPoolHashCheck] = useState<{
    ours: string;
    matches: boolean;
  } | null>(null);

  useEffect(() => {
    // Recompute poolHash from the snapshot as soon as the page loads — this
    // tells the user "yes, the pool we committed to matches the hash we
    // stored" before they even touch the server seed.
    (async () => {
      const snapshot: PoolEntry[] = commitment.poolSnapshot.map((e) => ({
        cardId: e.cardId,
        weight: e.weight,
        stock: e.stockAtOpen,
      }));
      const ours = await computePoolHash(snapshot);
      setPoolHashCheck({ ours, matches: ours === commitment.poolHash });
    })();
  }, [commitment.poolHash, commitment.poolSnapshot]);

  const canVerify = manualServerSeed.trim().length === 64;
  const pullByNonce = useMemo(() => {
    const map = new Map<number, VerifierPull>();
    for (const p of pulls) {
      if (p.nonce !== null && p.nonce !== undefined) map.set(p.nonce, p);
    }
    return map;
  }, [pulls]);

  async function runVerify() {
    setStatus("running");
    setError(null);
    setResults([]);

    try {
      const snapshot: PoolEntry[] = commitment.poolSnapshot.map((e) => ({
        cardId: e.cardId,
        weight: e.weight,
        stock: e.stockAtOpen,
      }));

      const outcomes: DrawOutcome[] = await replayDraws({
        serverSeed: manualServerSeed.trim(),
        clientSeed: commitment.clientSeed,
        nonceStart: commitment.nonceStart,
        nonceEnd: commitment.nonceEnd,
        poolHash: commitment.poolHash,
        poolSnapshot: snapshot,
      });

      const rows: RowResult[] = outcomes.map((o) => {
        const pull = pullByNonce.get(o.nonce);
        const state: MatchState = !pull
          ? "no_record"
          : pull.cardId === o.cardId
            ? "match"
            : "mismatch";
        return {
          nonce: o.nonce,
          expectedCardId: pull?.cardId ?? null,
          computedCardId: o.cardId,
          state,
          hmacHex: o.hmacHex,
          bucket: o.bucket.toString(),
          totalWeight: o.totalWeight.toString(),
        };
      });

      setResults(rows);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const mismatches = results.filter((r) => r.state === "mismatch").length;
  const matchedWithRecord = results.filter((r) => r.state === "match").length;
  const withoutRecord = results.filter((r) => r.state === "no_record").length;

  return (
    <div className="flex flex-col gap-4">
      <Card variant="topline" className="p-6">
        <h2 className="text-xl font-bold mb-4">Commitment</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-secondary">Commitment ID</dt>
          <dd className="font-mono break-all">{commitment.id}</dd>

          <dt className="text-text-secondary">Pack Group</dt>
          <dd className="font-mono break-all">{commitment.packGroupId}</dd>

          <dt className="text-text-secondary">Box</dt>
          <dd>{commitment.boxName?.de ?? commitment.boxName?.en ?? commitment.boxId}</dd>

          <dt className="text-text-secondary">Client Seed</dt>
          <dd className="font-mono break-all">{commitment.clientSeed}</dd>

          <dt className="text-text-secondary">Nonce-Range</dt>
          <dd>
            {commitment.nonceStart} bis {commitment.nonceEnd - 1} ({commitment.nonceEnd - commitment.nonceStart} Karten)
          </dd>

          <dt className="text-text-secondary">Pool-Hash (committed)</dt>
          <dd className="font-mono break-all">{commitment.poolHash}</dd>

          {poolHashCheck && (
            <>
              <dt className="text-text-secondary">Pool-Hash (nachgerechnet)</dt>
              <dd
                className={`font-mono break-all ${
                  poolHashCheck.matches ? "text-pa-green" : "text-error-light"
                }`}
              >
                {poolHashCheck.ours}
                {poolHashCheck.matches ? " ✓" : " ✗ stimmt nicht überein"}
              </dd>
            </>
          )}

          <dt className="text-text-secondary">Server-Seed-Hash (committed)</dt>
          <dd className="font-mono break-all">{commitment.serverSeedHashAtOpen}</dd>
        </dl>
      </Card>

      <Card variant="topline" className="p-6">
        <h2 className="text-xl font-bold mb-4">Server Seed</h2>
        {seed.serverSeed ? (
          <p className="text-sm text-text-secondary mb-3">
            Der Seed dieses Pulls wurde am{" "}
            {seed.revealedAt ? new Date(seed.revealedAt).toLocaleString() : "—"}{" "}
            enthüllt. Du kannst jetzt den ganzen Pull nachrechnen.
          </p>
        ) : (
          <p className="text-sm text-text-secondary mb-3">
            Der Server-Seed dieses Pulls ist noch aktiv und daher nicht sichtbar.
            Rotiere deinen Seed unter <span className="text-pa-green">Fairness &amp; Seeds</span>, um ihn zu enthüllen.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-secondary">Server Seed (64 Hex-Zeichen)</label>
          <input
            type="text"
            value={manualServerSeed}
            onChange={(e) => setManualServerSeed(e.target.value)}
            disabled={!!seed.serverSeed}
            className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
            placeholder="64 hex chars"
            spellCheck={false}
          />
        </div>
        <div className="mt-4 flex gap-3">
          <Button onClick={runVerify} disabled={!canVerify || status === "running"} loading={status === "running"}>
            Verifizieren
          </Button>
          {status === "done" && (
            <span
              className={
                mismatches === 0 ? "text-pa-green self-center" : "text-error-light self-center"
              }
            >
              {mismatches === 0
                ? `Alle ${results.length} Karten bestanden${
                    withoutRecord > 0 ? ` (${withoutRecord} ohne DB-Record)` : ""
                  } ✓`
                : `${mismatches} von ${matchedWithRecord + mismatches} weichen ab ✗`}
            </span>
          )}
          {status === "error" && (
            <span className="text-error-light self-center">{error}</span>
          )}
        </div>
      </Card>

      {results.length > 0 && (
        <Card variant="soft" className="p-6">
          <h2 className="text-xl font-bold mb-4">Ergebnisse</h2>
          <div className="flex flex-col gap-2">
            {results.map((r) => {
              const pull = pullByNonce.get(r.nonce);
              return (
                <details
                  key={r.nonce}
                  className={`rounded-[10px] border px-3 py-2 ${
                    r.state === "match"
                      ? "border-pa-green/30"
                      : r.state === "mismatch"
                        ? "border-error/40"
                        : "border-white/10"
                  }`}
                >
                  <summary className="cursor-pointer flex items-center justify-between gap-4">
                    <span className="font-mono text-sm">Nonce {r.nonce}</span>
                    <span className="flex-1">{pull?.cardName ?? r.computedCardId}</span>
                    <span
                      className={
                        r.state === "match"
                          ? "text-pa-green"
                          : r.state === "mismatch"
                            ? "text-error-light"
                            : "text-text-secondary"
                      }
                    >
                      {r.state === "match"
                        ? "✓ match"
                        : r.state === "mismatch"
                          ? "✗ diff"
                          : "kein DB-Record"}
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <span className="text-text-secondary">HMAC (hex)</span>
                    <span className="font-mono break-all">{r.hmacHex}</span>
                    <span className="text-text-secondary">Bucket</span>
                    <span className="font-mono">{r.bucket}</span>
                    <span className="text-text-secondary">Total Weight</span>
                    <span className="font-mono">{r.totalWeight}</span>
                    <span className="text-text-secondary">Erwartet (PackPull)</span>
                    <span className="font-mono break-all">
                      {r.expectedCardId ?? "— kein Record"}
                    </span>
                    <span className="text-text-secondary">Berechnet</span>
                    <span className="font-mono break-all">{r.computedCardId}</span>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}

      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-4">Pool-Snapshot</h2>
        <p className="text-sm text-text-secondary mb-3">
          Das war der exakte Kartenpool zum Zeitpunkt deiner Öffnung. Gewichte sind in Tausendsteln
          (Box-Gewicht × 1000).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-2">Karte</th>
                <th className="text-right py-2">Weight</th>
                <th className="text-right py-2">Stock @ Open</th>
              </tr>
            </thead>
            <tbody>
              {commitment.poolSnapshot.map((e) => (
                <tr key={e.cardId} className="border-t border-white/5">
                  <td className="py-1.5">{e.cardName}</td>
                  <td className="py-1.5 text-right font-mono">{e.weight}</td>
                  <td className="py-1.5 text-right font-mono">{e.stockAtOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
