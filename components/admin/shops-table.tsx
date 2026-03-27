"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ShopProfileRow {
  _id: string;
  companyName: string;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  licenseFileName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: { name: string; email: string };
  reviewedBy: { name: string } | null;
}

export function ShopsTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ShopProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shops?status=${statusFilter}&limit=50`);
      const data = (await res.json()) as { profiles: ShopProfileRow[] };
      setProfiles(data.profiles ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchProfiles(); }, [fetchProfiles]);

  async function handleAction(id: string, action: "approve" | "reject", reason?: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectReason: reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Fehler" });
      } else {
        toast({
          type: "success",
          title: action === "approve"
            ? (isDe ? "Shop freigeschaltet" : "Shop approved")
            : (isDe ? "Bewerbung abgelehnt" : "Application rejected"),
        });
        setRejectingId(null);
        setRejectReason("");
        await fetchProfiles();
      }
    } finally {
      setActionLoading(false);
    }
  }

  const statusLabels: Record<string, string> = {
    pending: isDe ? "Ausstehend" : "Pending",
    approved: isDe ? "Genehmigt" : "Approved",
    rejected: isDe ? "Abgelehnt" : "Rejected",
  };

  const activeTab = "bg-pa-green text-bg font-bold border border-pa-green";
  const inactiveTab = "bg-white/4 text-text-primary border border-white/8 hover:border-white/16";

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={[
              "px-4 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              statusFilter === s ? activeTab : inactiveTab,
            ].join(" ")}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-text-muted">
          {isDe ? "Keine Einträge." : "No entries."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-white/6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {isDe ? "Firma" : "Company"}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {isDe ? "Bewerber" : "Applicant"}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {isDe ? "Eingereicht" : "Submitted"}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {isDe ? "Dokument" : "Document"}
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Status
                </th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <React.Fragment key={p._id}>
                  <tr className="border-b border-white/6 hover:bg-white/2 transition-colors">
                    <td className="py-3 px-4 font-medium text-text-primary">{p.companyName}</td>
                    <td className="py-3 px-4">
                      <span className="text-text-primary">{p.user.name}</span>
                      <br />
                      <span className="text-xs text-text-muted">{p.user.email}</span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {new Date(p.submittedAt).toLocaleDateString(isDe ? "de-DE" : "en-US")}
                    </td>
                    <td className="py-3 px-4">
                      {p.licenseFileName ? (
                        <a
                          href={`/api/admin/shops/${p._id}/license`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pa-green hover:underline text-xs font-medium"
                        >
                          {isDe ? "Anzeigen" : "View"}
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={[
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          p.status === "approved"
                            ? "bg-success/10 text-success"
                            : p.status === "rejected"
                            ? "bg-error/10 text-error"
                            : "bg-pa-green/10 text-pa-green",
                        ].join(" ")}
                      >
                        {statusLabels[p.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {p.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => void handleAction(p._id, "approve")}
                          >
                            {isDe ? "Freischalten" : "Approve"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => setRejectingId(p._id)}
                          >
                            {isDe ? "Ablehnen" : "Reject"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rejectingId === p._id && (
                    <tr className="border-b border-white/6 bg-white/2">
                      <td colSpan={6} className="py-3 px-4">
                        <div className="flex gap-3 items-center">
                          <input
                            type="text"
                            placeholder={isDe ? "Ablehnungsgrund…" : "Rejection reason…"}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="flex-1 bg-white/3 border border-white/8 rounded-[10px] px-4 py-2 text-sm text-text-primary outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={actionLoading || !rejectReason.trim()}
                            onClick={() => void handleAction(p._id, "reject", rejectReason)}
                          >
                            {isDe ? "Bestätigen" : "Confirm"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          >
                            {isDe ? "Abbrechen" : "Cancel"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
