import type {
  FeedbackKind,
  FeedbackPriority,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackWaitingOn,
} from "@/lib/feedback-constants";

export interface FeedbackActorSummary {
  id: string;
  name: string;
  username: string | null;
  email?: string | null;
  role?: string;
  language?: string;
}

export interface FeedbackContextSummary {
  route: string | null;
  locale: string;
  userAgent: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  releaseId: string | null;
  objectType: string | null;
  objectId: string | null;
}

export interface FeedbackAttachmentSummary {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  isImage: boolean;
  url: string;
}

export interface FeedbackItemSummary {
  id: string;
  ticketNo: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  status: FeedbackStatus;
  waitingOn: FeedbackWaitingOn;
  priority: FeedbackPriority;
  severity: FeedbackSeverity;
  areaTags: string[];
  issueTags: string[];
  submitter: FeedbackActorSummary | null;
  assignedTo: FeedbackActorSummary | null;
  visibility: "private" | "restricted";
  source: string;
  context: FeedbackContextSummary;
  attachments: FeedbackAttachmentSummary[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  firstResponseAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  canEdit: boolean;
  canReply: boolean;
  isStaffView: boolean;
}

export interface FeedbackMessageSummary {
  id: string;
  body: string;
  isInternal: boolean;
  authorType: "user" | "staff" | "system";
  author: FeedbackActorSummary | null;
  attachments: FeedbackAttachmentSummary[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  editCount: number;
  canEdit: boolean;
}

export interface FeedbackAuditLogSummary {
  id: string;
  action: string;
  message: string;
  actorType: "user" | "staff" | "system";
  actor: FeedbackActorSummary | null;
  visibility: "public" | "internal";
  field: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
}

export interface FeedbackDetailResponse {
  feedback: FeedbackItemSummary;
  messages: FeedbackMessageSummary[];
  auditLogs: FeedbackAuditLogSummary[];
}

export interface FeedbackListResponse {
  items: FeedbackItemSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminFeedbackListResponse extends FeedbackListResponse {
  stats: {
    openCount: number;
    newCount: number;
    waitingOnStaffCount: number;
    assignedToMeCount: number;
    overdueCount: number;
    unassignedCount: number;
    waitingOnUserCount: number;
  };
}