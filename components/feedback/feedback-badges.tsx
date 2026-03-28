"use client";

import {
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "@/lib/feedback-constants";
import {
  getFeedbackKindLabel,
  getFeedbackPriorityLabel,
  getFeedbackSeverityLabel,
  getFeedbackStatusLabel,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";

function pillClassName(tone: string) {
  return [
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
    tone,
  ].join(" ");
}

const statusClasses: Record<FeedbackStatus, string> = {
  new: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  waiting: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
  planned: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
  in_progress: "border-pa-green/20 bg-pa-green/10 text-pa-green",
  closed: "border-white/12 bg-white/5 text-text-muted",
};

const priorityClasses: Record<FeedbackPriority, string> = {
  low: "border-white/12 bg-white/5 text-text-secondary",
  medium: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  high: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
  urgent: "border-red-400/20 bg-red-500/10 text-red-300",
};

const severityClasses: Record<FeedbackSeverity, string> = {
  cosmetic: "border-white/12 bg-white/5 text-text-secondary",
  minor: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  major: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
  critical: "border-red-400/20 bg-red-500/10 text-red-300",
};

const kindClasses: Record<FeedbackKind, string> = {
  bug_report: "border-red-400/20 bg-red-500/10 text-red-300",
  feature_request: "border-pa-green/20 bg-pa-green/10 text-pa-green",
  need_help: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  report_abuse: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
  general_feedback: "border-white/12 bg-white/5 text-text-secondary",
};

interface BadgeProps {
  lang?: string;
  dict?: FeedbackDictionary;
}

export function FeedbackStatusBadge({ status, lang = "en", dict = {} }: { status: FeedbackStatus } & BadgeProps) {
  return <span className={pillClassName(statusClasses[status])}>{getFeedbackStatusLabel(lang, status, dict)}</span>;
}

export function FeedbackPriorityBadge({ priority, lang = "en", dict = {} }: { priority: FeedbackPriority } & BadgeProps) {
  return <span className={pillClassName(priorityClasses[priority])}>{getFeedbackPriorityLabel(lang, priority, dict)}</span>;
}

export function FeedbackSeverityBadge({ severity, lang = "en", dict = {} }: { severity: FeedbackSeverity } & BadgeProps) {
  return <span className={pillClassName(severityClasses[severity])}>{getFeedbackSeverityLabel(lang, severity, dict)}</span>;
}

export function FeedbackKindBadge({ kind, lang = "en", dict = {} }: { kind: FeedbackKind } & BadgeProps) {
  return <span className={pillClassName(kindClasses[kind])}>{getFeedbackKindLabel(lang, kind, dict)}</span>;
}

export function formatFeedbackDate(value: string, lang: string) {
  return new Date(value).toLocaleString(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
