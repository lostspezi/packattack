import type {
  FeedbackKind,
  FeedbackMessageAuthorType,
  FeedbackPriority,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackWaitingOn,
} from "@/lib/feedback-constants";
import {
  getFeedbackActorLabel as getBaseFeedbackActorLabel,
  getFeedbackCopy as getBaseFeedbackCopy,
  getFeedbackKindLabel as getBaseFeedbackKindLabel,
  getFeedbackMessageCountLabel as getBaseFeedbackMessageCountLabel,
  getFeedbackPriorityLabel as getBaseFeedbackPriorityLabel,
  getFeedbackSeverityLabel as getBaseFeedbackSeverityLabel,
  getFeedbackStatusLabel as getBaseFeedbackStatusLabel,
  getFeedbackTicketCountLabel as getBaseFeedbackTicketCountLabel,
  getFeedbackWaitingLabel as getBaseFeedbackWaitingLabel,
  type FeedbackUiCopy,
} from "@/lib/feedback-copy";

export type FeedbackDictionary = Record<string, string>;

export interface FeedbackAttachmentCopy {
  title: string;
  download: string;
  pickerTitle: string;
  pickerHint: string;
  pickerButton: string;
  pickerRemove: string;
}

export interface FeedbackCountCopy {
  attachmentsSelected: string;
}

export interface FeedbackErrorCopy {
  unauthorized: string;
  forbidden: string;
  notFound: string;
  invalidInput: string;
  invalidRequest: string;
  invalidJson: string;
  noChanges: string;
  replyEmpty: string;
  invalidAssignee: string;
  tooMany: string;
  attachmentLimit: string;
  attachmentSize: string;
  attachmentType: string;
  serverError: string;
}

export interface FeedbackAuditCopy {
  created: string;
  attachmentsAddedOne: string;
  attachmentsAddedOther: string;
  replyAdded: string;
  internalNoteAdded: string;
  messageUpdated: string;
  titleUpdated: string;
  descriptionUpdated: string;
  kindUpdated: string;
  priorityUpdated: string;
  severityUpdated: string;
  areaTagsUpdated: string;
  issueTagsUpdated: string;
  assigned: string;
  unassigned: string;
  waitingUpdated: string;
  statusUpdated: string;
  genericUpdated: string;
}

export interface FeedbackAnalyticsMetaCopy {
  total: string;
  unassigned: string;
  waitingOnAdmin: string;
  waitingOnUser: string;
  last14Days: string;
  statusOverview: string;
  typeOverview: string;
  locales: string;
  countLabel: string;
}

export interface FeedbackUiLabels extends FeedbackUiCopy {
  attachments: FeedbackAttachmentCopy;
  counts: FeedbackCountCopy;
  errors: FeedbackErrorCopy;
  audit: FeedbackAuditCopy;
  analyticsMeta: FeedbackAnalyticsMetaCopy;
}

function readValue(dict: FeedbackDictionary, key: string, fallback: string): string {
  const value = dict[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function mergeSection<T extends { [K in keyof T]: string }>(
  section: T,
  prefix: string,
  dict: FeedbackDictionary
): T {
  const source = section as Record<string, string>;

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, readValue(dict, `${prefix}_${key}`, value)])
  ) as T;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

function attachmentDefaults(lang: string): FeedbackAttachmentCopy {
  if (lang === "de") {
    return {
      title: "Anhänge",
      download: "Herunterladen",
      pickerTitle: "Screenshots oder Dateien",
      pickerHint: "PNG, JPG, WEBP, PDF, TXT oder JSON. Maximal 4 Dateien mit jeweils bis zu 5 MB.",
      pickerButton: "Dateien auswählen",
      pickerRemove: "Entfernen",
    };
  }

  return {
    title: "Attachments",
    download: "Download",
    pickerTitle: "Screenshots or files",
    pickerHint: "PNG, JPG, WEBP, PDF, TXT, or JSON. Up to 4 files, 5 MB each.",
    pickerButton: "Choose files",
    pickerRemove: "Remove",
  };
}

function countDefaults(lang: string): FeedbackCountCopy {
  return {
    attachmentsSelected: lang === "de" ? "{count} / {max} ausgewählt" : "{count} / {max} selected",
  };
}

function errorDefaults(lang: string): FeedbackErrorCopy {
  if (lang === "de") {
    return {
      unauthorized: "Bitte melde dich erneut an.",
      forbidden: "Du hast keinen Zugriff auf dieses Ticket.",
      notFound: "Das angefragte Feedback-Ticket wurde nicht gefunden.",
      invalidInput: "Bitte prüfe deine Eingaben.",
      invalidRequest: "Die Anfrage konnte nicht verarbeitet werden.",
      invalidJson: "Ungültige Anfragedaten.",
      noChanges: "Es wurden keine Änderungen erkannt.",
      replyEmpty: "Eine Antwort oder ein Anhang ist erforderlich.",
      invalidAssignee: "Der ausgewählte Zuständige ist ungültig.",
      tooMany: "Bitte warte kurz, bevor du weiteres Feedback sendest.",
      attachmentLimit: "Es wurden zu viele Anhänge ausgewählt.",
      attachmentSize: "Mindestens eine Datei ist zu groß.",
      attachmentType: "Mindestens eine Datei hat einen nicht unterstützten Dateityp.",
      serverError: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    };
  }

  return {
    unauthorized: "Please log in again.",
    forbidden: "You do not have access to this ticket.",
    notFound: "The requested feedback ticket was not found.",
    invalidInput: "Please check your input.",
    invalidRequest: "The request could not be processed.",
    invalidJson: "Invalid request data.",
    noChanges: "No changes detected.",
    replyEmpty: "A reply or attachment is required.",
    invalidAssignee: "The selected assignee is invalid.",
    tooMany: "Please wait a moment before submitting more feedback.",
    attachmentLimit: "Too many attachments were selected.",
    attachmentSize: "One or more files are too large.",
    attachmentType: "One or more files use an unsupported file type.",
    serverError: "Something went wrong. Please try again.",
  };
}

function auditDefaults(lang: string): FeedbackAuditCopy {
  if (lang === "de") {
    return {
      created: "Ticket erstellt",
      attachmentsAddedOne: "1 Anhang hinzugefügt",
      attachmentsAddedOther: "{count} Anhänge hinzugefügt",
      replyAdded: "Antwort hinzugefügt",
      internalNoteAdded: "Interne Notiz hinzugefügt",
      messageUpdated: "Nachricht aktualisiert",
      titleUpdated: "Titel aktualisiert",
      descriptionUpdated: "Beschreibung aktualisiert",
      kindUpdated: "Tickettyp aktualisiert",
      priorityUpdated: "Priorität aktualisiert",
      severityUpdated: "Schweregrad aktualisiert",
      areaTagsUpdated: "Bereichs-Tags aktualisiert",
      issueTagsUpdated: "Problem-Tags aktualisiert",
      assigned: "Ticket zugewiesen",
      unassigned: "Zuweisung entfernt",
      waitingUpdated: "Wartezustand aktualisiert",
      statusUpdated: "Status aktualisiert",
      genericUpdated: "Ticket aktualisiert",
    };
  }

  return {
    created: "Ticket created",
    attachmentsAddedOne: "1 attachment added",
    attachmentsAddedOther: "{count} attachments added",
    replyAdded: "Reply added",
    internalNoteAdded: "Internal note added",
    messageUpdated: "Message updated",
    titleUpdated: "Title updated",
    descriptionUpdated: "Description updated",
    kindUpdated: "Ticket type updated",
    priorityUpdated: "Priority updated",
    severityUpdated: "Severity updated",
    areaTagsUpdated: "Area tags updated",
    issueTagsUpdated: "Issue tags updated",
    assigned: "Ticket assigned",
    unassigned: "Assignment removed",
    waitingUpdated: "Waiting state updated",
    statusUpdated: "Status updated",
    genericUpdated: "Ticket updated",
  };
}

function analyticsMetaDefaults(lang: string): FeedbackAnalyticsMetaCopy {
  if (lang === "de") {
    return {
      total: "Gesamt",
      unassigned: "Nicht zugewiesen",
      waitingOnAdmin: "Antwort vom Admin nötig",
      waitingOnUser: "Antwort vom Nutzer nötig",
      last14Days: "Neue Tickets in den letzten 14 Tagen",
      statusOverview: "Statusübersicht",
      typeOverview: "Tickettypen",
      locales: "Sprachen",
      countLabel: "Anzahl",
    };
  }

  return {
    total: "Total",
    unassigned: "Unassigned",
    waitingOnAdmin: "Admin reply needed",
    waitingOnUser: "User reply needed",
    last14Days: "New tickets in the last 14 days",
    statusOverview: "Status overview",
    typeOverview: "Ticket types",
    locales: "Languages",
    countLabel: "Count",
  };
}

export function getFeedbackUiCopy(lang: string, dict: FeedbackDictionary = {}): FeedbackUiLabels {
  const base = getBaseFeedbackCopy(lang);

  return {
    common: mergeSection(base.common, "common", dict),
    list: mergeSection(base.list, "list", dict),
    form: mergeSection(base.form, "form", dict),
    detail: mergeSection(base.detail, "detail", dict),
    inbox: mergeSection(base.inbox, "inbox", dict),
    analytics: mergeSection(base.analytics, "analytics", dict),
    attachments: mergeSection(attachmentDefaults(lang), "attachments", dict),
    counts: mergeSection(countDefaults(lang), "counts", dict),
    errors: mergeSection(errorDefaults(lang), "errors", dict),
    audit: mergeSection(auditDefaults(lang), "audit", dict),
    analyticsMeta: mergeSection(analyticsMetaDefaults(lang), "analyticsMeta", dict),
  };
}

export function getFeedbackKindLabel(lang: string, kind: FeedbackKind, dict: FeedbackDictionary = {}): string {
  return readValue(dict, `kind_${kind}`, getBaseFeedbackKindLabel(lang, kind));
}

export function getFeedbackStatusLabel(lang: string, status: FeedbackStatus, dict: FeedbackDictionary = {}): string {
  return readValue(dict, `status_${status}`, getBaseFeedbackStatusLabel(lang, status));
}

export function getFeedbackPriorityLabel(
  lang: string,
  priority: FeedbackPriority,
  dict: FeedbackDictionary = {}
): string {
  return readValue(dict, `priority_${priority}`, getBaseFeedbackPriorityLabel(lang, priority));
}

export function getFeedbackSeverityLabel(
  lang: string,
  severity: FeedbackSeverity,
  dict: FeedbackDictionary = {}
): string {
  return readValue(dict, `severity_${severity}`, getBaseFeedbackSeverityLabel(lang, severity));
}

export function getFeedbackWaitingLabel(
  lang: string,
  waitingOn: FeedbackWaitingOn,
  dict: FeedbackDictionary = {}
): string {
  const key = waitingOn === "user" ? "detail_waitingUser" : waitingOn === "staff" ? "detail_waitingStaff" : "detail_waitingNone";
  return readValue(dict, key, getBaseFeedbackWaitingLabel(lang, waitingOn));
}

export function getFeedbackActorLabel(
  lang: string,
  actorType: FeedbackMessageAuthorType | "system",
  dict: FeedbackDictionary = {}
): string {
  const key = actorType === "staff" ? "common_admin" : actorType === "user" ? "common_user" : "common_system";
  return readValue(dict, key, getBaseFeedbackActorLabel(lang, actorType));
}

export function getFeedbackTicketCountLabel(lang: string, count: number, dict: FeedbackDictionary = {}): string {
  if (Object.keys(dict).length === 0) {
    return getBaseFeedbackTicketCountLabel(lang, count);
  }

  const template = lang === "de"
    ? count === 1
      ? "{count} Ticket"
      : "{count} Tickets"
    : count === 1
      ? "{count} ticket"
      : "{count} tickets";

  const value = readValue(dict, count === 1 ? "counts_ticketOne" : "counts_ticketOther", template);
  return interpolate(value, { count });
}

export function getFeedbackMessageCountLabel(lang: string, count: number, dict: FeedbackDictionary = {}): string {
  if (Object.keys(dict).length === 0) {
    return getBaseFeedbackMessageCountLabel(lang, count);
  }

  const template = lang === "de"
    ? count === 1
      ? "{count} Nachricht"
      : "{count} Nachrichten"
    : count === 1
      ? "{count} message"
      : "{count} messages";

  const value = readValue(dict, count === 1 ? "counts_messageOne" : "counts_messageOther", template);
  return interpolate(value, { count });
}

export function getFeedbackAttachmentPickerCountLabel(
  lang: string,
  count: number,
  max: number,
  dict: FeedbackDictionary = {}
): string {
  const template = getFeedbackUiCopy(lang, dict).counts.attachmentsSelected;
  return interpolate(template, { count, max });
}

export function resolveFeedbackError(
  lang: string,
  error: unknown,
  dict: FeedbackDictionary = {},
  fallback?: string
): string {
  const labels = getFeedbackUiCopy(lang, dict).errors;
  if (!error) return fallback ?? labels.serverError;

  const raw = String(error).trim();
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  switch (normalized) {
    case "unauthorized":
      return labels.unauthorized;
    case "forbidden":
      return labels.forbidden;
    case "not_found":
      return labels.notFound;
    case "invalid_input":
      return labels.invalidInput;
    case "invalid_request":
      return labels.invalidRequest;
    case "invalid_json":
      return labels.invalidJson;
    case "no_changes_detected":
      return labels.noChanges;
    case "reply_cannot_be_empty":
      return labels.replyEmpty;
    case "invalid_assignee":
      return labels.invalidAssignee;
    case "server_error":
      return labels.serverError;
    case "too_many_feedback_submissions":
      return labels.tooMany;
    default:
      break;
  }

  const lowered = raw.toLowerCase();
  if (lowered.startsWith("unsupported file type")) return labels.attachmentType;
  if (lowered.startsWith("files must be")) return labels.attachmentSize;
  if (lowered.startsWith("you can upload up to")) return labels.attachmentLimit;
  if (lowered.startsWith("too many feedback")) return labels.tooMany;

  return fallback ?? labels.serverError;
}

function extractCountFromMessage(message: string): number | null {
  const match = message.match(/(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

export function formatFeedbackAuditMessage(
  lang: string,
  entry: { action: string; field: string | null; message: string },
  dict: FeedbackDictionary = {}
): string {
  const labels = getFeedbackUiCopy(lang, dict).audit;

  switch (entry.action) {
    case "created":
      return labels.created;
    case "attachments_added": {
      const count = extractCountFromMessage(entry.message);
      if (count === 1) return labels.attachmentsAddedOne;
      if (typeof count === "number") return interpolate(labels.attachmentsAddedOther, { count });
      return labels.attachmentsAddedOther.replace("{count}", lang === "de" ? "Mehrere" : "Several");
    }
    case "message_added":
      return labels.replyAdded;
    case "internal_note_added":
      return labels.internalNoteAdded;
    case "message_updated":
      return labels.messageUpdated;
    case "assigned":
      return labels.assigned;
    case "unassigned":
      return labels.unassigned;
    case "status_updated":
      return entry.field === "waitingOn" ? labels.waitingUpdated : labels.statusUpdated;
    case "ticket_updated":
      if (entry.field === "title") return labels.titleUpdated;
      if (entry.field === "description") return labels.descriptionUpdated;
      if (entry.field === "kind") return labels.kindUpdated;
      return labels.genericUpdated;
    case "triage_updated":
      if (entry.field === "priority") return labels.priorityUpdated;
      if (entry.field === "severity") return labels.severityUpdated;
      if (entry.field === "areaTags") return labels.areaTagsUpdated;
      if (entry.field === "issueTags") return labels.issueTagsUpdated;
      return labels.genericUpdated;
    default:
      return entry.message || labels.genericUpdated;
  }
}
