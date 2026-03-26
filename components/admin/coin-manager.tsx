"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Minus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface UserResult {
  _id: string;
  name: string;
  email: string;
  username?: string;
  image?: string | null;
  coins: number;
}

interface Transaction {
  _id: string;
  user: { name?: string; email?: string; username?: string } | null;
  amount: number;
  type: string;
  reason: string | null;
  performedBy: { name?: string; email?: string } | null;
  createdAt: string;
}

interface CoinManagerProps {
  lang: string;
}

export function CoinManager({ lang }: CoinManagerProps) {
  const isDe = lang === "de";
  const { toast } = useToast();

  // User search
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);

  // Grant form
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  // Search users
  useEffect(() => {
    if (userQuery.length < 2) {
      setUserResults([]);
      return;
    }
    setUserLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userQuery)}&limit=8`);
        if (!res.ok) return;
        const data = await res.json() as { users?: UserResult[] };
        setUserResults(data.users ?? []);
      } catch {
        setUserResults([]);
      } finally {
        setUserLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); setUserLoading(false); };
  }, [userQuery]);

  // Load transactions
  const loadTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (selectedUser) params.set("userId", selectedUser._id);
      const res = await fetch(`/api/admin/coins/transactions?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json() as { transactions: Transaction[]; total: number };
      setTransactions(data.transactions ?? []);
      setTxTotal(data.total ?? 0);
    } catch {
      // silent
    } finally {
      setTxLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    void loadTransactions(txPage);
  }, [txPage, loadTransactions]);

  async function handleGrant(isDeduct: boolean) {
    if (!selectedUser) return;
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) {
      toast({ type: "error", title: isDe ? "Betrag muss eine positive Ganzzahl sein" : "Amount must be a positive integer" });
      return;
    }
    if (!reason.trim()) {
      toast({ type: "error", title: isDe ? "Grund ist erforderlich" : "Reason is required" });
      return;
    }

    setGranting(true);
    try {
      const res = await fetch("/api/admin/coins/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser._id,
          amount: isDeduct ? -num : num,
          reason: reason.trim(),
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string; newBalance?: number };
      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Failed" });
        return;
      }
      setSelectedUser((prev) => prev ? { ...prev, coins: data.newBalance ?? prev.coins } : null);
      setAmount("");
      setReason("");
      toast({
        type: "success",
        title: isDe
          ? `${isDeduct ? "Abgezogen" : "Zugewiesen"}: ${num} Coins`
          : `${isDeduct ? "Deducted" : "Granted"}: ${num} coins`,
      });
      void loadTransactions(1);
      setTxPage(1);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setGranting(false);
    }
  }

  function typeLabel(type: string) {
    const map: Record<string, { de: string; en: string }> = {
      admin_grant: { de: "Zuweisung", en: "Grant" },
      admin_deduct: { de: "Abzug", en: "Deduction" },
      pack_purchase: { de: "Pack-Kauf", en: "Pack Purchase" },
      card_conversion: { de: "Karten-Umwandlung", en: "Card Conversion" },
    };
    return isDe ? (map[type]?.de ?? type) : (map[type]?.en ?? type);
  }

  function typeBadge(type: string) {
    if (type === "admin_grant") return "success" as const;
    if (type === "admin_deduct") return "error" as const;
    if (type === "pack_purchase") return "warning" as const;
    return "info" as const;
  }

  return (
    <div className="space-y-6">
      {/* User search + Grant form */}
      <div className="bg-surface border border-border rounded-[14px] p-5 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
          {isDe ? "Coins verwalten" : "Manage Coins"}
        </h3>

        {/* User search */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            {userLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-green animate-spin" />}
            <Input
              placeholder={isDe ? "User suchen (Name, E-Mail)…" : "Search user (name, email)…"}
              value={userQuery}
              onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
              className="pl-9 py-2.5 text-sm"
            />
          </div>

          {/* User results dropdown */}
          {userResults.length > 0 && !selectedUser && (
            <div className="absolute z-50 mt-1 w-full max-h-[240px] overflow-y-auto bg-surface-elevated border border-border rounded-[12px] shadow-xl">
              {userResults.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => { setSelectedUser(u); setUserQuery(u.name || u.email); setUserResults([]); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                    <p className="text-xs text-text-muted truncate">{u.email}</p>
                  </div>
                  <span className="text-sm font-medium text-pa-green tabular-nums">{(u.coins ?? 0).toLocaleString()} Coins</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected user + grant form */}
        {selectedUser && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/4 border border-border rounded-xl p-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{selectedUser.name}</p>
                <p className="text-xs text-text-muted">{selectedUser.email}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-pa-green tabular-nums">{(selectedUser.coins ?? 0).toLocaleString()}</p>
                <p className="text-[11px] text-text-muted">Coins</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-text-muted">
                  {isDe ? "Betrag (Coins)" : "Amount (Coins)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="100"
                  className="py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-text-muted">
                  {isDe ? "Grund" : "Reason"}
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={isDe ? "Grund angeben…" : "Enter reason…"}
                  className="py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={granting}
                disabled={!amount || !reason.trim()}
                onClick={() => void handleGrant(false)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {isDe ? "Zuweisen" : "Grant"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={granting}
                disabled={!amount || !reason.trim()}
                onClick={() => void handleGrant(true)}
              >
                <Minus className="w-3.5 h-3.5 mr-1" />
                {isDe ? "Abziehen" : "Deduct"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-surface border border-border rounded-[14px] p-5 space-y-4">
        <h3 className="text-base font-semibold text-text-primary">
          {isDe ? "Transaktions-Historie" : "Transaction History"}
          {selectedUser && (
            <span className="text-sm font-normal text-text-muted ml-2">
              — {selectedUser.name}
              <button
                type="button"
                onClick={() => { setSelectedUser(null); setUserQuery(""); }}
                className="text-xs text-pa-green ml-2 hover:underline"
              >
                {isDe ? "Alle anzeigen" : "Show all"}
              </button>
            </span>
          )}
        </h3>

        {txLoading ? (
          <div className="py-8 text-center text-text-muted text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            {isDe ? "Laden…" : "Loading…"}
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-text-muted text-sm">
            {isDe ? "Keine Transaktionen gefunden." : "No transactions found."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Datum" : "Date"}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">User</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Betrag" : "Amount"}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Typ</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Grund" : "Reason"}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Von" : "By"}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs text-text-muted tabular-nums">
                        {new Date(tx.createdAt).toLocaleString(isDe ? "de-DE" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-2 text-sm text-text-primary">
                        {(tx.user as { name?: string })?.name ?? "—"}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right tabular-nums font-medium ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={typeBadge(tx.type)}>{typeLabel(tx.type)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-text-secondary truncate max-w-[200px]">{tx.reason ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">
                        {(tx.performedBy as { name?: string })?.name ?? "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txTotal > 20 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-text-muted">
                  {txTotal.toLocaleString()} {isDe ? "Transaktionen" : "transactions"}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)}>
                    {isDe ? "Zurück" : "Previous"}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={txPage * 20 >= txTotal} onClick={() => setTxPage((p) => p + 1)}>
                    {isDe ? "Weiter" : "Next"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
