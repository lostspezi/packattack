"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/lib/feedback-constants";
import {
  getFeedbackKindLabel,
  getFeedbackStatusLabel,
  getFeedbackTicketCountLabel,
  getFeedbackUiCopy,
  resolveFeedbackError,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";
import type { AdminFeedbackListResponse, FeedbackItemSummary } from "@/types/feedback";
import {
  FeedbackKindBadge,
  FeedbackPriorityBadge,
  FeedbackStatusBadge,
  formatFeedbackDate,
} from "@/components/feedback/feedback-badges";

interface AdminFeedbackInboxProps {
  lang: string;
  dict?: FeedbackDictionary;
}

export function AdminFeedbackInbox({ lang, dict = {} }: AdminFeedbackInboxProps) {
  const copy = getFeedbackUiCopy(lang, dict);
  const { toast } = useToast();
  const [items, setItems] = useState<FeedbackItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [assigned, setAssigned] = useState("");
  const [scope, setScope] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    openCount: 0,
    newCount: 0,
    waitingOnStaffCount: 0,
    assignedToMeCount: 0,
    overdueCount: 0,
  });

  useEffect(() => {
    setPage(1);
  }, [assigned, kind, scope, search, status]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "12");
        if (status) params.set("status", status);
        if (kind) params.set("kind", kind);
        if (assigned) params.set("assigned", assigned);
        if (scope) params.set("scope", scope);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/admin/feedback?${params.toString()}`);
        const payload = await res.json();

        if (!res.ok) {
          toast({
            type: "error",
            title: resolveFeedbackError(lang, payload.error, dict, copy.common.networkError),
          });
          return;
        }

        if (!active) return;

        const data = payload as AdminFeedbackListResponse;
        setItems(data.items);
        setStats(data.stats);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch {
        toast({ type: "error", title: copy.common.networkError });
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [assigned, copy.common.networkError, dict, kind, lang, page, scope, search, status, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card variant="topline" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.open}</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{stats.openCount}</p>
          </Card>
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.inbox.newLabel}</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{stats.newCount}</p>
          </Card>
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.inbox.waitingCard}</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{stats.waitingOnStaffCount}</p>
          </Card>
          <Card variant="accent" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.inbox.assignedToMe}</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{stats.assignedToMeCount}</p>
          </Card>
          <Card variant="cut" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.inbox.overdue}</p>
            <p className="mt-2 text-3xl font-bold text-pa-green">{stats.overdueCount}</p>
          </Card>
        </div>

        <Link href={`/${lang}/admin/feedback/analytics`} className="shrink-0">
          <span className="inline-flex items-center justify-center rounded-[10px] border border-white/8 bg-white/4 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/8">
            {copy.inbox.analytics}
          </span>
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,180px))]">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.inbox.searchPlaceholder}
        />
        <Select
          options={[
            { value: "", label: copy.common.allStatuses },
            ...FEEDBACK_STATUSES.map((value) => ({ value, label: getFeedbackStatusLabel(lang, value, dict) })),
          ]}
          value={status}
          onChange={setStatus}
          className="w-full"
        />
        <Select
          options={[
            { value: "", label: copy.common.allTypes },
            ...FEEDBACK_KINDS.map((value) => ({ value, label: getFeedbackKindLabel(lang, value, dict) })),
          ]}
          value={kind}
          onChange={setKind}
          className="w-full"
        />
        <Select
          options={[
            { value: "", label: copy.common.assignedToAll },
            { value: "me", label: copy.inbox.assignedToMe },
            { value: "unassigned", label: copy.inbox.unassigned },
          ]}
          value={assigned}
          onChange={setAssigned}
          className="w-full"
        />
        <Select
          options={[
            { value: "", label: copy.inbox.allScopes },
            { value: "attention", label: copy.inbox.needsAttention },
          ]}
          value={scope}
          onChange={setScope}
          className="w-full"
        />
      </div>

      <p className="text-xs text-text-muted">{getFeedbackTicketCountLabel(lang, total, dict)}</p>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.ticket}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.type}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.status}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.priority}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.submitter}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.assigned}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{copy.inbox.updated}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">{copy.inbox.loading}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">{copy.inbox.empty}</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-white/3">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/${lang}/admin/feedback/${item.id}`} className="block">
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{item.ticketNo}</p>
                      <p className="mt-1 text-sm font-medium text-text-primary">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{item.description}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top"><FeedbackKindBadge kind={item.kind} lang={lang} dict={dict} /></td>
                  <td className="px-4 py-3 align-top"><FeedbackStatusBadge status={item.status} lang={lang} dict={dict} /></td>
                  <td className="px-4 py-3 align-top"><FeedbackPriorityBadge priority={item.priority} lang={lang} dict={dict} /></td>
                  <td className="px-4 py-3 align-top text-sm text-text-secondary">{item.submitter?.name ?? copy.common.user}</td>
                  <td className="px-4 py-3 align-top text-sm text-text-secondary">{item.assignedTo?.name ?? copy.common.unassigned}</td>
                  <td className="px-4 py-3 align-top text-sm text-text-secondary">{formatFeedbackDate(item.lastActivityAt, lang)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
