"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type {
  AdminBadgeMutationResponse,
  AdminUserBadgeSummaryResponse,
  BadgeDefinitionSummary,
  BadgeSummary,
} from "@/types/badges";

interface BadgeTargetUser {
  id: string;
  username: string;
  name: string;
  email: string;
}

interface UserBadgeManagerModalProps {
  open: boolean;
  onClose: () => void;
  user: BadgeTargetUser | null;
  lang: string;
}

function isGranted(badge: BadgeDefinitionSummary, grantedBadges: BadgeSummary[]) {
  return grantedBadges.some((granted) => granted.key === badge.key);
}

export function UserBadgeManagerModal({
  open,
  onClose,
  user,
  lang,
}: UserBadgeManagerModalProps) {
  const { toast } = useToast();
  const isDe = lang === "de";
  const [loading, setLoading] = useState(false);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<AdminUserBadgeSummaryResponse | null>(null);

  useEffect(() => {
    if (!open || !user) {
      setPayload(null);
      return;
    }

    let cancelled = false;
    const targetUser = user;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${targetUser.id}/badges`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const nextPayload = (await res.json()) as AdminUserBadgeSummaryResponse;
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch {
        if (!cancelled) {
          toast({
            type: "error",
            title: isDe ? "Badges konnten nicht geladen werden." : "Failed to load badges.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isDe, open, toast, user]);

  const availableBadges = useMemo(() => payload?.availableBadges ?? [], [payload]);
  const grantedBadges = useMemo(() => payload?.badges ?? [], [payload]);

  async function mutateBadge(action: "grant" | "revoke", badgeKey: string) {
    if (!user) return;
    setMutatingKey(`${action}:${badgeKey}`);
    try {
      const res = await fetch(`/api/admin/badges/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "grant"
            ? {
                userId: user.id,
                badgeKey,
              }
            : {
                userId: user.id,
                badgeKey,
              }
        ),
      });

      if (!res.ok) {
        throw new Error("mutation_failed");
      }

      const nextPayload = (await res.json()) as
        | AdminUserBadgeSummaryResponse
        | AdminBadgeMutationResponse;

      if ("availableBadges" in nextPayload) {
        setPayload(nextPayload);
      } else {
        setPayload((current) =>
          current
            ? {
                ...current,
                badges: nextPayload.badges,
              }
            : current
        );
      }

      toast({
        type: "success",
        title:
          action === "grant"
            ? isDe
              ? "Badge wurde vergeben."
              : "Badge granted."
            : isDe
              ? "Badge wurde entfernt."
              : "Badge revoked.",
      });
    } catch {
      toast({
        type: "error",
        title:
          action === "grant"
            ? isDe
              ? "Badge konnte nicht vergeben werden."
              : "Failed to grant badge."
            : isDe
              ? "Badge konnte nicht entfernt werden."
              : "Failed to revoke badge.",
      });
    } finally {
      setMutatingKey(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isDe
          ? `Badges für ${user?.username ?? ""}`
          : `Badges for ${user?.username ?? ""}`
      }
      size="lg"
    >
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !payload ? (
        <p className="text-sm text-text-secondary">
          {isDe ? "Keine Badge-Daten verfügbar." : "No badge data available."}
        </p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[14px] border border-white/8 bg-white/4 p-4">
            <p className="text-sm font-semibold text-text-primary">
              {payload.user.username ?? payload.user.name}
            </p>
            <p className="mt-1 text-sm text-text-secondary">{payload.user.email ?? "—"}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-pa-green" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {isDe ? "Aktive Badges" : "Active badges"}
              </h3>
            </div>
            {grantedBadges.length === 0 ? (
              <p className="text-sm text-text-secondary">
                {isDe ? "Noch keine Badges vergeben." : "No badges granted yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {grantedBadges.map((badge) => (
                  <div
                    key={badge.key}
                    className="flex items-start justify-between gap-4 rounded-[14px] border border-white/8 bg-white/4 p-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      {badge.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={badge.iconUrl}
                          alt={badge.label}
                          className="h-12 w-12 rounded-[12px] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/8 bg-white/6 text-xs font-semibold text-text-primary">
                          {badge.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{badge.label}</p>
                        {badge.description ? (
                          <p className="mt-1 text-xs text-text-secondary">{badge.description}</p>
                        ) : null}
                        {badge.awardedAt ? (
                          <p className="mt-1 text-[11px] text-text-muted">
                            {isDe ? "Verliehen:" : "Awarded:"}{" "}
                            {new Date(badge.awardedAt).toLocaleDateString(isDe ? "de-DE" : "en-US")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={mutatingKey === `revoke:${badge.key}`}
                      onClick={() => void mutateBadge("revoke", badge.key)}
                    >
                      {isDe ? "Entfernen" : "Revoke"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-pa-green" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {isDe ? "Verfügbare Badges" : "Available badges"}
              </h3>
            </div>
            <div className="space-y-3">
              {availableBadges.map((badge) => {
                const granted = isGranted(badge, grantedBadges);
                return (
                  <div
                    key={badge.key}
                    className="flex items-start justify-between gap-4 rounded-[14px] border border-white/8 bg-white/4 p-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      {badge.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={badge.iconUrl}
                          alt={badge.label}
                          className="h-12 w-12 rounded-[12px] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/8 bg-white/6 text-xs font-semibold text-text-primary">
                          {badge.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{badge.label}</p>
                        {badge.description ? (
                          <p className="mt-1 text-xs text-text-secondary">{badge.description}</p>
                        ) : null}
                      </div>
                    </div>
                    {granted ? (
                      <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-3 py-1 text-xs font-semibold text-pa-green">
                        {isDe ? "Vergeben" : "Granted"}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        loading={mutatingKey === `grant:${badge.key}`}
                        onClick={() => void mutateBadge("grant", badge.key)}
                      >
                        {isDe ? "Vergeben" : "Grant"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
