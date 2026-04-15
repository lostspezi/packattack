"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Award, Loader2, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface BadgeDefinition {
  id: string;
  key: string;
  label: string;
  iconUrl: string | null;
  tone: string;
}

interface PreviewCategory {
  count: number;
  users: Array<{ name: string; username?: string }>;
}

interface PreviewData {
  preview: Record<string, PreviewCategory>;
  totalCompleted: number;
  alreadyDistributed: boolean;
  distributedAt: string | null;
}

interface DistributionResult {
  granted: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; badgeKey: string; error: string }>;
}

interface Mapping {
  placement: 1 | 2 | 3 | "completed";
  badgeKey: string;
}

const DEFAULT_MAPPINGS: Mapping[] = [
  { placement: 1, badgeKey: "quiz_1st" },
  { placement: 2, badgeKey: "quiz_2nd" },
  { placement: 3, badgeKey: "quiz_3rd" },
  { placement: "completed", badgeKey: "quiz_participant" },
];

const PLACEMENT_LABELS: Record<string, { label: string; icon: string }> = {
  "1": { label: "1. Platz", icon: "🥇" },
  "2": { label: "2. Platz", icon: "🥈" },
  "3": { label: "3. Platz", icon: "🥉" },
  completed: { label: "Alle anderen Teilnehmer", icon: "" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  alreadyDistributed: boolean;
  distributedAt: string | null;
  onDistributed: () => void;
}

type Step = "configure" | "preview" | "distributing" | "done";

export function QuizBadgeDistributionModal({
  open,
  onClose,
  eventId,
  eventTitle,
  alreadyDistributed,
  distributedAt,
  onDistributed,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("configure");
  const [mappings, setMappings] = useState<Mapping[]>(DEFAULT_MAPPINGS);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<DistributionResult | null>(null);
  const [force, setForce] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("configure");
      setMappings(DEFAULT_MAPPINGS);
      setPreview(null);
      setResult(null);
      setForce(false);
    }
  }, [open]);

  // Fetch available badges
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/badges")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.badges)) setBadges(data.badges);
      })
      .catch(() => {});
  }, [open]);

  const updateMapping = useCallback(
    (placement: 1 | 2 | 3 | "completed", badgeKey: string) => {
      setMappings((prev) =>
        prev.map((m) => (m.placement === placement ? { ...m, badgeKey } : m)),
      );
    },
    [],
  );

  async function fetchPreview() {
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/admin/quiz-events/${eventId}/distribute-badges`,
      );
      if (!res.ok) throw new Error("Failed to load preview");
      const data = (await res.json()) as PreviewData;
      setPreview(data);
      setStep("preview");
    } catch {
      toast({ type: "error", title: "Vorschau konnte nicht geladen werden" });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleDistribute() {
    setStep("distributing");
    try {
      const res = await fetch(
        `/api/admin/quiz-events/${eventId}/distribute-badges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappings, force }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "already_distributed") {
          toast({
            type: "error",
            title: "Badges wurden bereits verteilt",
            message: "Aktiviere 'Erneut verteilen' um fortzufahren.",
          });
          setStep("preview");
          return;
        }
        throw new Error(data.error ?? "Distribution failed");
      }
      setResult(data.results as DistributionResult);
      setStep("done");
      onDistributed();
    } catch (err) {
      toast({
        type: "error",
        title: "Fehler bei der Verteilung",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
      setStep("preview");
    }
  }

  function handleClose() {
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Badges verteilen"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Event: <span className="font-medium text-text-secondary">{eventTitle}</span>
        </p>

        {/* Step: Configure */}
        {step === "configure" && (
          <>
            <div className="space-y-3">
              {mappings.map((mapping) => {
                const meta = PLACEMENT_LABELS[String(mapping.placement)];
                return (
                  <div
                    key={String(mapping.placement)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-2 w-[200px] shrink-0">
                      {mapping.placement === "completed" ? (
                        <Users className="w-4 h-4 text-text-muted" />
                      ) : (
                        <Trophy className="w-4 h-4 text-pa-green" />
                      )}
                      <span className="text-sm font-medium text-text-primary">
                        {meta?.icon} {meta?.label}
                      </span>
                    </div>
                    <select
                      value={mapping.badgeKey}
                      onChange={(e) =>
                        updateMapping(mapping.placement, e.target.value)
                      }
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
                    >
                      {badges.map((badge) => (
                        <option key={badge.key} value={badge.key}>
                          {badge.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {alreadyDistributed && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-400">
                    Badges wurden bereits verteilt
                  </p>
                  <p className="text-text-muted mt-0.5">
                    Am{" "}
                    {distributedAt
                      ? new Date(distributedAt).toLocaleString("de-DE")
                      : "unbekannt"}
                    . Duplikate werden automatisch uebersprungen.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={force}
                      onChange={(e) => setForce(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-text-secondary">
                      Erneut verteilen (fehlende Badges werden nachgetragen)
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button
                onClick={fetchPreview}
                disabled={loadingPreview || (alreadyDistributed && !force)}
              >
                {loadingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Award className="w-4 h-4 mr-1.5" />
                )}
                Vorschau
              </Button>
            </div>
          </>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <>
            <div className="space-y-2">
              {mappings.map((mapping) => {
                const meta = PLACEMENT_LABELS[String(mapping.placement)];
                const cat = preview.preview[String(mapping.placement)];
                const badge = badges.find((b) => b.key === mapping.badgeKey);
                return (
                  <div
                    key={String(mapping.placement)}
                    className="flex items-center justify-between rounded-lg border border-border bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-3">
                      {badge?.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={badge.iconUrl}
                          alt=""
                          className="w-6 h-6"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {meta?.icon} {meta?.label}
                        </p>
                        <p className="text-xs text-text-muted">
                          {badge?.label ?? mapping.badgeKey}
                        </p>
                        {cat && cat.users.length > 0 && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            {cat.users
                              .map((u) => u.username || u.name)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-text-primary">
                      {cat?.count ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-text-muted">
              Gesamt:{" "}
              <span className="font-medium text-text-primary">
                {preview.totalCompleted}
              </span>{" "}
              abgeschlossene Teilnehmer
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("configure")}>
                Zurueck
              </Button>
              <Button onClick={handleDistribute}>
                <Award className="w-4 h-4 mr-1.5" />
                {preview.totalCompleted} Badges verteilen
              </Button>
            </div>
          </>
        )}

        {/* Step: Distributing */}
        {step === "distributing" && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-pa-green mb-3" />
            <p className="text-sm text-text-muted">
              Badges werden verteilt...
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <>
            <div className="py-4 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-pa-green mb-3" />
              <p className="text-lg font-bold text-text-primary">
                Verteilung abgeschlossen
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-pa-green/20 bg-pa-green/5 p-3 text-center">
                <p className="text-2xl font-bold text-pa-green">
                  {result.granted}
                </p>
                <p className="text-xs text-text-muted">Vergeben</p>
              </div>
              <div className="rounded-lg border border-border bg-white/[0.02] p-3 text-center">
                <p className="text-2xl font-bold text-text-secondary">
                  {result.skipped}
                </p>
                <p className="text-xs text-text-muted">Uebersprungen</p>
              </div>
              {result.failed > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {result.failed}
                  </p>
                  <p className="text-xs text-text-muted">Fehlgeschlagen</p>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 mt-2">
                <p className="text-sm font-medium text-red-400 mb-1">
                  Fehler:
                </p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-text-muted">
                    {err.userId}: {err.error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleClose}>Schliessen</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
