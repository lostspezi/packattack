"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_SEED_PATTERN } from "@/lib/fairness";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface FairnessStateProps {
  clientSeed: string | null;
  initializedAt: string | null;
  activeSeed: {
    id: string;
    serverSeedHash: string;
    nonce: number;
    activatedAt: string;
  } | null;
  revealedSeeds: Array<{
    id: string;
    serverSeedHash: string;
    nonce: number;
    activatedAt: string;
    revealedAt: string | null;
  }>;
}

interface RevealModalData {
  revealedServerSeed: string | null;
  revealedServerSeedHash?: string;
  newServerSeedHash: string;
}

export default function SeedManager(props: FairnessStateProps) {
  const router = useRouter();
  const [clientSeed, setClientSeed] = useState(props.clientSeed ?? "");
  const [savingSeed, setSavingSeed] = useState(false);
  const [seedSaveNote, setSeedSaveNote] = useState<string | null>(null);
  const [seedSaveError, setSeedSaveError] = useState<string | null>(null);

  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [revealData, setRevealData] = useState<RevealModalData | null>(null);

  const seedValid = CLIENT_SEED_PATTERN.test(clientSeed);

  async function saveClientSeed() {
    setSavingSeed(true);
    setSeedSaveNote(null);
    setSeedSaveError(null);
    try {
      const res = await fetch("/api/fairness/client-seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientSeed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "save failed");
      setSeedSaveNote("Client-Seed gespeichert. Gilt ab der nächsten Öffnung.");
      router.refresh();
    } catch (err) {
      setSeedSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSeed(false);
    }
  }

  async function rotateServerSeed() {
    if (
      !confirm(
        "Server-Seed jetzt rotieren? Der vollständige aktive Server-Seed (nicht nur der Hash) wird dir einmalig angezeigt, und ein neuer Seed wird aktiv.",
      )
    )
      return;
    setRotating(true);
    setRotateError(null);
    try {
      const res = await fetch("/api/fairness/rotate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "rotate failed");
      }
      setRevealData({
        revealedServerSeed: data.revealedServerSeed ?? null,
        revealedServerSeedHash: data.revealedServerSeedHash,
        newServerSeedHash: data.newServerSeedHash,
      });
      router.refresh();
    } catch (err) {
      setRotateError(err instanceof Error ? err.message : String(err));
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {revealData && (
        <Card variant="accent" className="p-6">
          <h2 className="text-xl font-bold mb-2">Server-Seed enthüllt</h2>
          <p className="text-sm text-text-secondary mb-3">
            Das ist der vollständige geheime Seed, der zum öffentlichen Hash deines bisherigen
            Commitments gehört. Speichere ihn, wenn du auf externen Tools nachrechnen möchtest —
            er wird <strong>nicht</strong> erneut angezeigt.
          </p>
          {revealData.revealedServerSeed && (
            <div className="mb-3">
              <label className="text-xs text-text-secondary">
                Enthüllter Server-Seed (das Geheimnis — ab jetzt öffentlich)
              </label>
              <div className="font-mono text-sm bg-white/4 rounded-[10px] p-3 break-all">
                {revealData.revealedServerSeed}
              </div>
            </div>
          )}
          <div className="mb-1">
            <label className="text-xs text-text-secondary">
              Neuer Commitment-Hash (Seed dazu bleibt geheim bis zur nächsten Rotation)
            </label>
            <div className="font-mono text-sm bg-white/4 rounded-[10px] p-3 break-all">
              {revealData.newServerSeedHash}
            </div>
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setRevealData(null)}>
              Schließen
            </Button>
          </div>
        </Card>
      )}

      <Card variant="topline" className="p-6">
        <h2 className="text-xl font-bold mb-2">Client Seed</h2>
        <p className="text-sm text-text-secondary mb-4">
          Dein Client-Seed geht in jeden deiner Rolls ein. Du kannst ihn jederzeit ändern. Zulässig sind
          8 bis 64 Zeichen: Buchstaben, Ziffern, Bindestrich, Unterstrich.
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
            placeholder="z.B. my-lucky-seed-2026"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {clientSeed ? (seedValid ? "Format OK" : "Ungültiges Format") : "Leer"}
            </span>
            <Button size="sm" onClick={saveClientSeed} disabled={!seedValid || savingSeed} loading={savingSeed}>
              Speichern
            </Button>
          </div>
          {seedSaveNote && <span className="text-pa-green text-sm">{seedSaveNote}</span>}
          {seedSaveError && <span className="text-error-light text-sm">{seedSaveError}</span>}
        </div>
      </Card>

      <Card variant="topline" className="p-6">
        <h2 className="text-xl font-bold mb-2">Aktiver Server-Seed — Commitment</h2>
        <p className="text-sm text-text-secondary mb-2">
          Der vollständige Server-Seed ist ein 64-Zeichen-Geheimnis. Du siehst unten nur den
          SHA-256-Hash davon als Beweis, dass wir uns <strong>vor</strong> deinen Rolls festgelegt
          haben.
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Beim Rotieren zeigen wir dir den vollen Seed, der zu diesem Hash gehört — damit kannst
          du alle vergangenen Rolls selbst nachrechnen.
        </p>
        {props.activeSeed ? (
          <>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-4">
              <span className="text-text-secondary">Commitment-Hash (öffentlich)</span>
              <span className="font-mono break-all">{props.activeSeed.serverSeedHash}</span>
              <span className="text-text-secondary">Nonce</span>
              <span className="font-mono">{props.activeSeed.nonce}</span>
              <span className="text-text-secondary">Aktiviert</span>
              <span>{new Date(props.activeSeed.activatedAt).toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={rotateServerSeed} loading={rotating}>
                Rotieren &amp; Seed enthüllen
              </Button>
              {rotateError && <span className="text-error-light self-center text-sm">{rotateError}</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            Noch kein Server-Seed initialisiert — der wird bei deinem ersten Pack-Open automatisch
            generiert.
          </p>
        )}
      </Card>

      <Card variant="soft" className="p-6">
        <h2 className="text-xl font-bold mb-2">Rotierte Seeds (Historie)</h2>
        {props.revealedSeeds.length === 0 ? (
          <p className="text-sm text-text-secondary">Noch keine rotierten Seeds.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-secondary">
                <tr>
                  <th className="text-left py-2">Aktiv von</th>
                  <th className="text-left py-2">Bis</th>
                  <th className="text-left py-2">Hash</th>
                  <th className="text-right py-2">Nonce</th>
                </tr>
              </thead>
              <tbody>
                {props.revealedSeeds.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-1.5">{new Date(s.activatedAt).toLocaleDateString()}</td>
                    <td className="py-1.5">{s.revealedAt ? new Date(s.revealedAt).toLocaleDateString() : "—"}</td>
                    <td className="py-1.5 font-mono text-xs break-all">{s.serverSeedHash}</td>
                    <td className="py-1.5 text-right font-mono">{s.nonce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
