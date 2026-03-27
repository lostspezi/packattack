"use client";

import React, { useState, useEffect, useCallback } from "react";

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
  const [profiles, setProfiles] = useState<ShopProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectReason: reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback(data.error ?? "Fehler");
      } else {
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-white"
                : "border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {feedback && <p className="text-sm text-error">{feedback}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {isDe ? "Keine Einträge." : "No entries."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4">{isDe ? "Firma" : "Company"}</th>
                <th className="py-2 pr-4">{isDe ? "Bewerber" : "Applicant"}</th>
                <th className="py-2 pr-4">{isDe ? "Eingereicht" : "Submitted"}</th>
                <th className="py-2 pr-4">{isDe ? "Dokument" : "Document"}</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <React.Fragment key={p._id}>
                  <tr className="border-b border-border hover:bg-surface/50">
                    <td className="py-2 pr-4 font-medium text-text-primary">{p.companyName}</td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {p.user.name}
                      <br />
                      <span className="text-xs">{p.user.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {new Date(p.submittedAt).toLocaleDateString(isDe ? "de-DE" : "en-US")}
                    </td>
                    <td className="py-2 pr-4">
                      {p.licenseFileName ? (
                        <a
                          href={`/api/admin/shops/${p._id}/license`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline text-xs"
                        >
                          {isDe ? "Anzeigen" : "View"}
                        </a>
                      ) : (
                        <span className="text-text-secondary text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "approved"
                            ? "bg-success/10 text-success"
                            : p.status === "rejected"
                            ? "bg-error/10 text-error"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {statusLabels[p.status]}
                      </span>
                    </td>
                    <td className="py-2">
                      {p.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleAction(p._id, "approve")}
                            disabled={actionLoading}
                            className="rounded bg-success px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {isDe ? "Freischalten" : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectingId(p._id)}
                            disabled={actionLoading}
                            className="rounded border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10 disabled:opacity-50"
                          >
                            {isDe ? "Ablehnen" : "Reject"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rejectingId === p._id && (
                    <tr className="border-b border-border bg-surface/30">
                      <td colSpan={6} className="py-3 px-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={isDe ? "Ablehnungsgrund…" : "Rejection reason…"}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => void handleAction(p._id, "reject", rejectReason)}
                            disabled={actionLoading || !rejectReason.trim()}
                            className="rounded bg-error px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {isDe ? "Bestätigen" : "Confirm"}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            className="rounded border border-border px-2 py-1.5 text-xs text-text-secondary"
                          >
                            {isDe ? "Abbrechen" : "Cancel"}
                          </button>
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
