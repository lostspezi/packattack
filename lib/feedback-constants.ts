export const FEEDBACK_KINDS = [
  "bug_report",
  "feature_request",
  "need_help",
  "report_abuse",
  "general_feedback",
] as const;

export const FEEDBACK_STATUSES = [
  "new",
  "waiting",
  "planned",
  "in_progress",
  "closed",
] as const;

export const FEEDBACK_WAITING_ON = ["user", "staff", "none"] as const;

export const FEEDBACK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const FEEDBACK_SEVERITIES = [
  "cosmetic",
  "minor",
  "major",
  "critical",
] as const;

export const FEEDBACK_VISIBILITIES = ["private", "restricted"] as const;

export const FEEDBACK_SOURCES = [
  "dashboard",
  "account",
  "settings",
  "admin",
  "manual",
] as const;

export const FEEDBACK_MESSAGE_AUTHOR_TYPES = ["user", "staff", "system"] as const;

export const FEEDBACK_AUDIT_VISIBILITIES = ["public", "internal"] as const;

export const FEEDBACK_STAFF_ROLES = ["admin", "super_admin"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackWaitingOn = (typeof FEEDBACK_WAITING_ON)[number];
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];
export type FeedbackVisibility = (typeof FEEDBACK_VISIBILITIES)[number];
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];
export type FeedbackMessageAuthorType = (typeof FEEDBACK_MESSAGE_AUTHOR_TYPES)[number];
export type FeedbackAuditVisibility = (typeof FEEDBACK_AUDIT_VISIBILITIES)[number];
export type FeedbackStaffRole = (typeof FEEDBACK_STAFF_ROLES)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  need_help: "Need Help",
  report_abuse: "Report Abuse",
  general_feedback: "General Feedback",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  waiting: "Waiting",
  planned: "Planned",
  in_progress: "In Progress",
  closed: "Closed",
};

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const FEEDBACK_SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  cosmetic: "Cosmetic",
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

export const FEEDBACK_OPEN_STATUSES: FeedbackStatus[] = [
  "new",
  "waiting",
  "planned",
  "in_progress",
];