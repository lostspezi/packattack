"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_SEED_PATTERN, randomHex } from "@/lib/fairness";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SeedState =
  | { kind: "empty" }
  | { kind: "too_short"; missing: number }
  | { kind: "too_long"; over: number }
  | { kind: "bad_chars" }
  | { kind: "ok" };

function seedState(v: string): SeedState {
  if (v.length === 0) return { kind: "empty" };
  if (v.length < 8) return { kind: "too_short", missing: 8 - v.length };
  if (v.length > 64) return { kind: "too_long", over: v.length - 64 };
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return { kind: "bad_chars" };
  return { kind: "ok" };
}

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
  const state = seedState(clientSeed);

  function generateClientSeed() {
    // randomHex is the same helper the server uses for auto-init, so
    // users who hit "Zufällig" land on an equivalent byte-strength seed.
    setClientSeed(randomHex(16));
    setSeedSaveNote(null);
    setSeedSaveError(null);
  }

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
          <div className="flex gap-2">
            <input
              type="text"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
              className="flex-1 bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 font-mono text-sm"
              placeholder="Eigenen Seed tippen oder 'Zufällig' nutzen"
              spellCheck={false}
            />
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={generateClientSeed}
              title="Einen zufälligen, kryptographisch sicheren Seed erzeugen"
            >
              Zufällig
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SeedStatusIndicator state={state} length={clientSeed.length} />
            <Button
              size="sm"
              onClick={saveClientSeed}
              disabled={!seedValid || savingSeed}
              loading={savingSeed}
            >
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

function SeedStatusIndicator({ state, length }: { state: SeedState; length: number }) {
  let dotClass = "bg-white/20";
  let label = "Noch nichts eingegeben";
  let tone = "text-text-secondary";

  switch (state.kind) {
    case "empty":
      break;
    case "too_short":
      dotClass = "bg-error";
      tone = "text-error-light";
      label = `Zu kurz — noch ${state.missing} Zeichen fehlen (mind. 8)`;
      break;
    case "too_long":
      dotClass = "bg-error";
      tone = "text-error-light";
      label = `Zu lang — ${state.over} Zeichen zu viel (max. 64)`;
      break;
    case "bad_chars":
      dotClass = "bg-error";
      tone = "text-error-light";
      label = "Ungültige Zeichen — erlaubt: A–Z, a–z, 0–9, - _";
      break;
    case "ok":
      dotClass = "bg-pa-green";
      tone = "text-pa-green";
      label = `Gültig · ${length} Zeichen`;
      break;
  }

  return (
    <span className={`inline-flex items-center gap-2 text-xs ${tone}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}
