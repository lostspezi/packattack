import Link from "next/link";
import connectDB from "@/lib/db";
import { Card } from "@/components/ui/card";
import { FEEDBACK_OPEN_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback-constants";
import {
  getFeedbackKindLabel,
  getFeedbackStatusLabel,
  getFeedbackUiCopy,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";
import FeedbackItem from "@/models/feedback-item";

function formatHours(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  if (value < 1) return `${Math.round(value * 60)} min`;
  return `${Math.round(value * 10) / 10} h`;
}

function getMaxCount<T extends { count: number }>(items: T[]) {
  return Math.max(...items.map((item) => item.count), 1);
}

function formatTrendDate(value: string, lang: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(lang, {
    month: "short",
    day: "numeric",
  });
}

export async function AdminFeedbackAnalytics({ lang, dict = {} }: { lang: string; dict?: FeedbackDictionary }) {
  const copy = getFeedbackUiCopy(lang, dict);
  await connectDB();

  const overdueQuery = {
    status: { $in: FEEDBACK_OPEN_STATUSES },
    $expr: {
      $lte: ["$lastActivityAt", { $dateSubtract: { startDate: "$$NOW", unit: "hour", amount: 36 } }],
    },
  };

  const [
    totalCount,
    openCount,
    overdueCount,
    reopenedCount,
    unassignedCount,
    waitingOnAdminCount,
    waitingOnUserCount,
    firstResponseAgg,
    resolutionAgg,
    topRoutes,
    topKinds,
    topIssueTags,
    statusBreakdown,
    localeBreakdown,
    recentVolume,
    oldestOpen,
  ] = await Promise.all([
    FeedbackItem.countDocuments({}),
    FeedbackItem.countDocuments({ status: { $in: FEEDBACK_OPEN_STATUSES } }),
    FeedbackItem.countDocuments(overdueQuery),
    FeedbackItem.countDocuments({ reopenCount: { $gt: 0 } }),
    FeedbackItem.countDocuments({ status: { $in: FEEDBACK_OPEN_STATUSES }, assignedTo: null }),
    FeedbackItem.countDocuments({ status: "waiting", waitingOn: "staff" }),
    FeedbackItem.countDocuments({ status: "waiting", waitingOn: "user" }),
    FeedbackItem.aggregate([
      { $match: { firstResponseAt: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ["$firstResponseAt", "$createdAt"] }, 1000 * 60 * 60] } } },
      { $group: { _id: null, avgHours: { $avg: "$hours" } } },
    ]),
    FeedbackItem.aggregate([
      { $match: { closedAt: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ["$closedAt", "$createdAt"] }, 1000 * 60 * 60] } } },
      { $group: { _id: null, avgHours: { $avg: "$hours" } } },
    ]),
    FeedbackItem.aggregate([
      { $group: { _id: { $ifNull: ["$context.route", "(unknown)"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    FeedbackItem.aggregate([
      { $group: { _id: "$kind", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    FeedbackItem.aggregate([
      { $unwind: "$issueTags" },
      { $group: { _id: "$issueTags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    FeedbackItem.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    FeedbackItem.aggregate([
      { $group: { _id: { $ifNull: ["$context.locale", "unknown"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    FeedbackItem.aggregate([
      {
        $match: {
          $expr: {
            $gte: ["$createdAt", { $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 13 } }],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    FeedbackItem.find({ status: { $in: FEEDBACK_OPEN_STATUSES } })
      .sort({ createdAt: 1 })
      .limit(5)
      .select("ticketNo title createdAt status")
      .lean(),
  ]);

  const avgFirstResponseHours = (firstResponseAgg[0]?.avgHours as number | undefined) ?? null;
  const avgResolutionHours = (resolutionAgg[0]?.avgHours as number | undefined) ?? null;
  const statusMax = getMaxCount(statusBreakdown);
  const recentMax = getMaxCount(recentVolume);
  const typeMax = getMaxCount(topKinds);
  const localeMax = getMaxCount(localeBreakdown);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{copy.analytics.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.analytics.subtitle}</p>
        </div>
        <Link href={`/${lang}/admin/feedback`} className="inline-flex items-center justify-center rounded-[10px] border border-white/8 bg-white/4 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/8">
          {copy.analytics.backToInbox}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card variant="topline" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analyticsMeta.total}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{totalCount}</p>
        </Card>
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.open}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{openCount}</p>
        </Card>
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.overdue}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{overdueCount}</p>
        </Card>
        <Card variant="accent" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.avgFirstResponse}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{formatHours(avgFirstResponseHours)}</p>
        </Card>
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.avgResolution}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{formatHours(avgResolutionHours)}</p>
        </Card>
        <Card variant="cut" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analytics.reopened}</p>
          <p className="mt-2 text-3xl font-bold text-pa-green">{reopenedCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analyticsMeta.unassigned}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{unassignedCount}</p>
        </Card>
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analyticsMeta.waitingOnAdmin}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{waitingOnAdminCount}</p>
        </Card>
        <Card variant="soft" className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{copy.analyticsMeta.waitingOnUser}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{waitingOnUserCount}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card variant="soft" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analyticsMeta.last14Days}</h3>
            <span className="text-xs text-text-muted">{copy.analyticsMeta.countLabel}</span>
          </div>
          <div className="space-y-3">
            {recentVolume.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              recentVolume.map((entry) => (
                <div key={String(entry._id)} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span>{formatTrendDate(String(entry._id), lang)}</span>
                    <span className="font-medium text-text-primary">{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-pa-green" style={{ width: `${Math.max((entry.count / recentMax) * 100, 8)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="soft" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analyticsMeta.statusOverview}</h3>
            <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
          </div>
          <div className="space-y-3">
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              statusBreakdown.map((entry) => (
                <div key={String(entry._id)} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span>{getFeedbackStatusLabel(lang, entry._id as FeedbackStatus, dict)}</span>
                    <span className="font-medium text-text-primary">{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-white/20" style={{ width: `${Math.max((entry.count / statusMax) * 100, 8)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="soft" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analytics.topRoutes}</h3>
            <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
          </div>
          <div className="space-y-3">
            {topRoutes.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              topRoutes.map((entry) => (
                <div key={String(entry._id)} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/8 bg-white/3 px-3 py-2">
                  <span className="truncate text-sm text-text-secondary">{String(entry._id)}</span>
                  <span className="text-sm font-semibold text-text-primary">{entry.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="soft" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analytics.topIssueTags}</h3>
            <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
          </div>
          <div className="space-y-3">
            {topIssueTags.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              topIssueTags.map((entry) => (
                <div key={String(entry._id)} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/8 bg-white/3 px-3 py-2">
                  <span className="truncate text-sm text-text-secondary">{String(entry._id)}</span>
                  <span className="text-sm font-semibold text-text-primary">{entry.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="accent" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analyticsMeta.typeOverview}</h3>
            <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
          </div>
          <div className="space-y-3">
            {topKinds.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              topKinds.map((entry) => (
                <div key={String(entry._id)} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span>{getFeedbackKindLabel(lang, entry._id as FeedbackKind, dict)}</span>
                    <span className="font-medium text-text-primary">{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-pa-green" style={{ width: `${Math.max((entry.count / typeMax) * 100, 8)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="soft" className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">{copy.analyticsMeta.locales}</h3>
            <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
          </div>
          <div className="space-y-3">
            {localeBreakdown.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.analytics.none}</p>
            ) : (
              localeBreakdown.map((entry) => (
                <div key={String(entry._id)} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span>{String(entry._id).toUpperCase()}</span>
                    <span className="font-medium text-text-primary">{entry.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-white/20" style={{ width: `${Math.max((entry.count / localeMax) * 100, 8)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card variant="soft" className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">{copy.analytics.oldestOpen}</h3>
          <span className="text-xs text-text-muted">{copy.analytics.tickets}</span>
        </div>
        <div className="space-y-3">
          {oldestOpen.length === 0 ? (
            <p className="text-sm text-text-muted">{copy.analytics.none}</p>
          ) : (
            oldestOpen.map((entry) => (
              <Link key={entry._id.toString()} href={`/${lang}/admin/feedback/${entry._id.toString()}`} className="block rounded-[10px] border border-white/8 bg-white/3 px-3 py-3 transition-colors hover:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{entry.ticketNo}</p>
                    <p className="mt-1 truncate text-sm font-medium text-text-primary">{entry.title}</p>
                  </div>
                  <div className="text-right text-xs text-text-muted">
                    <p>{new Date(entry.createdAt).toLocaleDateString(lang)}</p>
                    <p className="mt-1 text-text-secondary">{getFeedbackStatusLabel(lang, entry.status as FeedbackStatus, dict)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
