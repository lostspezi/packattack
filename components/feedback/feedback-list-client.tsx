"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import type { FeedbackListResponse, FeedbackItemSummary } from "@/types/feedback";
import { FeedbackKindBadge, FeedbackStatusBadge, formatFeedbackDate } from "@/components/feedback/feedback-badges";

interface FeedbackListClientProps {
  lang: string;
  dict?: FeedbackDictionary;
}

export function FeedbackListClient({ lang, dict = {} }: FeedbackListClientProps) {
  const copy = getFeedbackUiCopy(lang, dict);
  const { toast } = useToast();
  const [items, setItems] = useState<FeedbackItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [kind, status]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "8");
        if (status) params.set("status", status);
        if (kind) params.set("kind", kind);
        const res = await fetch(`/api/feedback?${params.toString()}`);
        const data: FeedbackListResponse | { error?: string } = await res.json();

        if (!res.ok) {
          toast({
            type: "error",
            title: resolveFeedbackError(lang, (data as { error?: string }).error, dict, copy.form.createError),
          });
          return;
        }

        if (active) {
          const payload = data as FeedbackListResponse;
          setItems(payload.items);
          setTotal(payload.total);
          setTotalPages(payload.totalPages);
        }
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
  }, [copy.common.networkError, copy.form.createError, dict, kind, lang, page, status, toast]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            options={[
              { value: "", label: copy.common.allStatuses },
              ...FEEDBACK_STATUSES.map((value) => ({ value, label: getFeedbackStatusLabel(lang, value, dict) })),
            ]}
            value={status}
            onChange={setStatus}
            className="w-full min-w-[180px]"
          />
          <Select
            options={[
              { value: "", label: copy.common.allTypes },
              ...FEEDBACK_KINDS.map((value) => ({ value, label: getFeedbackKindLabel(lang, value, dict) })),
            ]}
            value={kind}
            onChange={setKind}
            className="w-full min-w-[180px]"
          />
        </div>

        <Link href={`/${lang}/feedback/new`}>
          <Button variant="primary">{copy.common.newFeedback}</Button>
        </Link>
      </div>

      <p className="text-xs text-text-muted">{getFeedbackTicketCountLabel(lang, total, dict)}</p>

      {loading ? (
        <Card variant="soft" className="p-6 text-sm text-text-muted">
          {copy.common.loading}
        </Card>
      ) : items.length === 0 ? (
        <Card variant="soft" className="p-6 text-sm text-text-muted">
          {status || kind ? copy.list.noMatches : copy.list.empty}
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Link key={item.id} href={`/${lang}/feedback/${item.id}`}>
              <Card variant="soft" className="p-5 transition-colors hover:border-pa-green/20">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{item.ticketNo}</span>
                      <FeedbackStatusBadge status={item.status} lang={lang} dict={dict} />
                      <FeedbackKindBadge kind={item.kind} lang={lang} dict={dict} />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                    <p className="line-clamp-2 text-sm text-text-secondary">{item.description}</p>
                  </div>

                  <div className="shrink-0 text-xs text-text-muted md:text-right">
                    <p>{copy.common.updated}</p>
                    <p className="mt-1 text-text-secondary">{formatFeedbackDate(item.lastActivityAt, lang)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
