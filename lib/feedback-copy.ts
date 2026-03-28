import type {
  FeedbackKind,
  FeedbackMessageAuthorType,
  FeedbackPriority,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackWaitingOn,
} from "@/lib/feedback-constants";

export interface FeedbackUiCopy {
  common: {
    feedback: string;
    all: string;
    allStatuses: string;
    allTypes: string;
    assignedToAll: string;
    newFeedback: string;
    loading: string;
    networkError: string;
    updated: string;
    created: string;
    lastActivity: string;
    waiting: string;
    assigned: string;
    unassigned: string;
    save: string;
    cancel: string;
    edit: string;
    submit: string;
    sendReply: string;
    addInternalNote: string;
    viewTicket: string;
    openTicket: string;
    admin: string;
    user: string;
    system: string;
  };
  list: {
    empty: string;
    noMatches: string;
    myFeedbackTitle: string;
    myFeedbackSubtitle: string;
  };
  form: {
    pageTitle: string;
    pageSubtitle: string;
    typeLabel: string;
    titleLabel: string;
    titlePlaceholder: string;
    detailsLabel: string;
    detailsPlaceholder: string;
    requiredError: string;
    createdSuccess: string;
    createError: string;
  };
  detail: {
    waitingUser: string;
    waitingStaff: string;
    waitingNone: string;
    conversation: string;
    noReplies: string;
    replyLabel: string;
    internalNoteLabel: string;
    replyPlaceholder: string;
    internalNotePlaceholder: string;
    replySent: string;
    internalNoteSaved: string;
    replyRequired: string;
    activityLog: string;
    activitySubtitle: string;
    noActivity: string;
    editTicket: string;
    editMessage: string;
    saveChanges: string;
    ticketUpdated: string;
    messageUpdated: string;
    saveTriage: string;
    triageTitle: string;
    triageSubtitle: string;
    statusLabel: string;
    waitingLabel: string;
    priorityLabel: string;
    severityLabel: string;
    assigneeLabel: string;
    assigneePlaceholder: string;
    areaTagsLabel: string;
    areaTagsPlaceholder: string;
    issueTagsLabel: string;
    issueTagsPlaceholder: string;
    triageSaved: string;
    loadingTicket: string;
    loadError: string;
    requestFailed: string;
    descriptionLabel: string;
  };
  inbox: {
    pageTitle: string;
    pageSubtitle: string;
    searchPlaceholder: string;
    assignedToMe: string;
    unassigned: string;
    needsAttention: string;
    allScopes: string;
    waitingCard: string;
    overdue: string;
    open: string;
    newLabel: string;
    submitter: string;
    assigned: string;
    ticket: string;
    type: string;
    status: string;
    priority: string;
    updated: string;
    loading: string;
    empty: string;
    analytics: string;
  };
  analytics: {
    title: string;
    subtitle: string;
    backToInbox: string;
    open: string;
    overdue: string;
    avgFirstResponse: string;
    avgResolution: string;
    reopened: string;
    topRoutes: string;
    route: string;
    tickets: string;
    topTypes: string;
    topIssueTags: string;
    oldestOpen: string;
    none: string;
  };
}

const en: FeedbackUiCopy = {
  common: {
    feedback: "Feedback",
    all: "All",
    allStatuses: "All",
    allTypes: "All types",
    assignedToAll: "Assigned to all",
    newFeedback: "New Feedback",
    loading: "Loading...",
    networkError: "Network error",
    updated: "Updated",
    created: "Created",
    lastActivity: "Last activity",
    waiting: "Needs reply",
    assigned: "Assigned",
    unassigned: "Unassigned",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    submit: "Submit Feedback",
    sendReply: "Send Reply",
    addInternalNote: "Add Internal Note",
    viewTicket: "View Ticket",
    openTicket: "Open Ticket",
    admin: "Admin",
    user: "User",
    system: "System",
  },
  list: {
    empty: "You haven't submitted any feedback yet.",
    noMatches: "No feedback tickets found.",
    myFeedbackTitle: "Feedback",
    myFeedbackSubtitle: "Track your tickets, reply to admins, and see what still needs attention.",
  },
  form: {
    pageTitle: "New Feedback",
    pageSubtitle: "Report a bug, ask for help, or share a product idea.",
    typeLabel: "Type",
    titleLabel: "Title",
    titlePlaceholder: "Short summary of the issue or request",
    detailsLabel: "Details",
    detailsPlaceholder: "What happened, what did you expect, and anything else that helps us understand it.",
    requiredError: "Title and details are required",
    createdSuccess: "Feedback submitted",
    createError: "Failed to create feedback",
  },
  detail: {
    waitingUser: "User reply needed",
    waitingStaff: "Admin reply needed",
    waitingNone: "Nothing pending",
    conversation: "Conversation",
    noReplies: "No replies yet.",
    replyLabel: "Reply",
    internalNoteLabel: "Internal note",
    replyPlaceholder: "Write your reply...",
    internalNotePlaceholder: "Write an internal note...",
    replySent: "Reply sent",
    internalNoteSaved: "Internal note added",
    replyRequired: "Add a reply or at least one attachment",
    activityLog: "Activity Log",
    activitySubtitle: "Every edit and ticket change is recorded here.",
    noActivity: "No activity recorded yet.",
    editTicket: "Edit Ticket",
    editMessage: "Edit Message",
    saveChanges: "Save Changes",
    ticketUpdated: "Ticket updated",
    messageUpdated: "Message updated",
    saveTriage: "Save Changes",
    triageTitle: "Ticket Details",
    triageSubtitle: "Manage status, assignee, and tags.",
    statusLabel: "Status",
    waitingLabel: "Who needs to reply",
    priorityLabel: "Priority",
    severityLabel: "Severity",
    assigneeLabel: "Assignee",
    assigneePlaceholder: "Admin username or email",
    areaTagsLabel: "Area Tags",
    areaTagsPlaceholder: "auth, dashboard, boxes",
    issueTagsLabel: "Issue Tags",
    issueTagsPlaceholder: "ui, data-quality, performance",
    triageSaved: "Changes saved",
    loadingTicket: "Loading ticket...",
    loadError: "Failed to load ticket",
    requestFailed: "Request failed",
    descriptionLabel: "Description",
  },
  inbox: {
    pageTitle: "Feedback Inbox",
    pageSubtitle: "Review open tickets, assign ownership, and keep the queue moving.",
    searchPlaceholder: "Search by ticket number, title, or description...",
    assignedToMe: "Assigned to me",
    unassigned: "Unassigned",
    needsAttention: "Needs attention",
    allScopes: "All scopes",
    waitingCard: "Waiting",
    overdue: "Overdue",
    open: "Open",
    newLabel: "New",
    submitter: "Submitter",
    assigned: "Assigned",
    ticket: "Ticket",
    type: "Type",
    status: "Status",
    priority: "Priority",
    updated: "Updated",
    loading: "Loading feedback inbox...",
    empty: "No tickets match the current filters.",
    analytics: "Analytics",
  },
  analytics: {
    title: "Feedback Analytics",
    subtitle: "See where pain is concentrated and where the queue is slowing down.",
    backToInbox: "Back to Inbox",
    open: "Open",
    overdue: "Overdue",
    avgFirstResponse: "Avg. First Response",
    avgResolution: "Avg. Close Time",
    reopened: "Reopened",
    topRoutes: "Pages with the most reports",
    route: "Route",
    tickets: "Tickets",
    topTypes: "Top Ticket Types",
    topIssueTags: "Most common problem themes",
    oldestOpen: "Oldest Open Tickets",
    none: "No data yet.",
  },
};

const de: FeedbackUiCopy = {
  common: {
    feedback: "Feedback",
    all: "Alle",
    allStatuses: "Alle Status",
    allTypes: "Alle Typen",
    assignedToAll: "Alle Zust\u00E4ndigen",
    newFeedback: "Neues Feedback",
    loading: "Wird geladen...",
    networkError: "Netzwerkfehler",
    updated: "Aktualisiert",
    created: "Erstellt",
    lastActivity: "Letzte Aktivit\u00E4t",
    waiting: "Antwort n\u00F6tig",
    assigned: "Zugewiesen",
    unassigned: "Nicht zugewiesen",
    save: "Speichern",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    submit: "Feedback senden",
    sendReply: "Antwort senden",
    addInternalNote: "Interne Notiz speichern",
    viewTicket: "Ticket ansehen",
    openTicket: "Ticket \u00F6ffnen",
    admin: "Admin",
    user: "Nutzer",
    system: "System",
  },
  list: {
    empty: "Du hast noch kein Feedback gesendet.",
    noMatches: "Keine Feedback-Tickets gefunden.",
    myFeedbackTitle: "Feedback",
    myFeedbackSubtitle: "Behalte deine Tickets im Blick, antworte auf Admins und sieh, was noch offen ist.",
  },
  form: {
    pageTitle: "Neues Feedback",
    pageSubtitle: "Melde einen Bug, frage nach Hilfe oder teile eine Produktidee.",
    typeLabel: "Typ",
    titleLabel: "Titel",
    titlePlaceholder: "Kurze Zusammenfassung des Problems oder Wunsches",
    detailsLabel: "Details",
    detailsPlaceholder: "Was ist passiert, was hast du erwartet und was hilft uns noch beim Verstehen?",
    requiredError: "Bitte gib einen Titel mit mindestens 4 Zeichen und eine Beschreibung mit mindestens 10 Zeichen ein.",
    createdSuccess: "Feedback gesendet",
    createError: "Feedback konnte nicht erstellt werden",
  },
  detail: {
    waitingUser: "Antwort vom Nutzer n\u00F6tig",
    waitingStaff: "Antwort vom Admin n\u00F6tig",
    waitingNone: "Nichts offen",
    conversation: "Konversation",
    noReplies: "Noch keine Antworten.",
    replyLabel: "Antwort",
    internalNoteLabel: "Interne Notiz",
    replyPlaceholder: "Schreibe deine Antwort...",
    internalNotePlaceholder: "Schreibe eine interne Notiz...",
    replySent: "Antwort gesendet",
    internalNoteSaved: "Interne Notiz gespeichert",
    replyRequired: "F\u00FCge eine Antwort oder mindestens einen Anhang hinzu",
    activityLog: "Aktivit\u00E4tsprotokoll",
    activitySubtitle: "Jede \u00C4nderung und jede Ticket-Aktion wird hier festgehalten.",
    noActivity: "Noch keine Aktivit\u00E4t erfasst.",
    editTicket: "Ticket bearbeiten",
    editMessage: "Nachricht bearbeiten",
    saveChanges: "\u00C4nderungen speichern",
    ticketUpdated: "Ticket aktualisiert",
    messageUpdated: "Nachricht aktualisiert",
    saveTriage: "\u00C4nderungen speichern",
    triageTitle: "Bearbeitung",
    triageSubtitle: "Bearbeite Status, Zust\u00E4ndigkeit und Tags.",
    statusLabel: "Status",
    waitingLabel: "Wer muss antworten",
    priorityLabel: "Priorit\u00E4t",
    severityLabel: "Schweregrad",
    assigneeLabel: "Zust\u00E4ndig",
    assigneePlaceholder: "Admin-Benutzername oder E-Mail",
    areaTagsLabel: "Bereichs-Tags",
    areaTagsPlaceholder: "auth, dashboard, boxes",
    issueTagsLabel: "Problem-Tags",
    issueTagsPlaceholder: "ui, daten, performance",
    triageSaved: "\u00C4nderungen gespeichert",
    loadingTicket: "Ticket wird geladen...",
    loadError: "Ticket konnte nicht geladen werden",
    requestFailed: "Anfrage fehlgeschlagen",
    descriptionLabel: "Beschreibung",
  },
  inbox: {
    pageTitle: "Feedback-Inbox",
    pageSubtitle: "Pr\u00FCfe offene Tickets, weise Verantwortung zu und halte die Queue in Bewegung.",
    searchPlaceholder: "Nach Ticketnummer, Titel oder Beschreibung suchen...",
    assignedToMe: "Mir zugewiesen",
    unassigned: "Nicht zugewiesen",
    needsAttention: "Braucht Aufmerksamkeit",
    allScopes: "Alle Ansichten",
    waitingCard: "Wartend",
    overdue: "\u00DCberf\u00E4llig",
    open: "Offen",
    newLabel: "Neu",
    submitter: "Ersteller",
    assigned: "Zugewiesen",
    ticket: "Ticket",
    type: "Typ",
    status: "Status",
    priority: "Priorit\u00E4t",
    updated: "Aktualisiert",
    loading: "Feedback-Inbox wird geladen...",
    empty: "Keine Tickets passen zu den aktuellen Filtern.",
    analytics: "Analysen",
  },
  analytics: {
    title: "Feedback-Analysen",
    subtitle: "Sieh, wo sich Probleme h\u00E4ufen und wo die Queue langsamer wird.",
    backToInbox: "Zur\u00FCck zur Inbox",
    open: "Offen",
    overdue: "\u00DCberf\u00E4llig",
    avgFirstResponse: "Ø Erste Antwort",
    avgResolution: "Ø Abschlusszeit",
    reopened: "Wieder ge\u00F6ffnet",
    topRoutes: "Seiten mit den meisten Meldungen",
    route: "Route",
    tickets: "Tickets",
    topTypes: "Top-Tickettypen",
    topIssueTags: "H\u00E4ufigste Problemthemen",
    oldestOpen: "\u00C4lteste offene Tickets",
    none: "Noch keine Daten.",
  },
};

const kindLabels = {
  en: {
    bug_report: "Bug Report",
    feature_request: "Feature Request",
    need_help: "Need Help",
    report_abuse: "Report Abuse",
    general_feedback: "General Feedback",
  },
  de: {
    bug_report: "Bug melden",
    feature_request: "Feature-Wunsch",
    need_help: "Hilfe",
    report_abuse: "Missbrauch melden",
    general_feedback: "Allgemeines Feedback",
  },
} as const;

const statusLabels = {
  en: {
    new: "New",
    waiting: "Needs reply",
    planned: "Planned",
    in_progress: "In Progress",
    closed: "Closed",
  },
  de: {
    new: "Neu",
    waiting: "Antwort n\u00F6tig",
    planned: "Geplant",
    in_progress: "In Arbeit",
    closed: "Geschlossen",
  },
} as const;

const priorityLabels = {
  en: {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  },
  de: {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    urgent: "Dringend",
  },
} as const;

const severityLabels = {
  en: {
    cosmetic: "Cosmetic",
    minor: "Minor",
    major: "Major",
    critical: "Critical",
  },
  de: {
    cosmetic: "Kosmetisch",
    minor: "Leicht",
    major: "Erheblich",
    critical: "Kritisch",
  },
} as const;

function getLocale(lang: string) {
  return lang === "de" ? "de" : "en";
}

export function getFeedbackCopy(lang: string): FeedbackUiCopy {
  return getLocale(lang) === "de" ? de : en;
}

export function getFeedbackKindLabel(lang: string, kind: FeedbackKind): string {
  return kindLabels[getLocale(lang)][kind];
}

export function getFeedbackStatusLabel(lang: string, status: FeedbackStatus): string {
  return statusLabels[getLocale(lang)][status];
}

export function getFeedbackPriorityLabel(lang: string, priority: FeedbackPriority): string {
  return priorityLabels[getLocale(lang)][priority];
}

export function getFeedbackSeverityLabel(lang: string, severity: FeedbackSeverity): string {
  return severityLabels[getLocale(lang)][severity];
}

export function getFeedbackWaitingLabel(lang: string, waitingOn: FeedbackWaitingOn): string {
  const copy = getFeedbackCopy(lang);

  if (waitingOn === "user") return copy.detail.waitingUser;
  if (waitingOn === "staff") return copy.detail.waitingStaff;
  return copy.detail.waitingNone;
}

export function getFeedbackActorLabel(lang: string, actorType: FeedbackMessageAuthorType | "system"): string {
  const copy = getFeedbackCopy(lang);

  if (actorType === "staff") return copy.common.admin;
  if (actorType === "user") return copy.common.user;
  return copy.common.system;
}

export function getFeedbackTicketCountLabel(lang: string, count: number): string {
  const locale = getLocale(lang);

  if (locale === "de") {
    return `${count} Ticket${count === 1 ? "" : "s"}`;
  }

  return `${count} ticket${count === 1 ? "" : "s"}`;
}

export function getFeedbackMessageCountLabel(lang: string, count: number): string {
  const locale = getLocale(lang);

  if (locale === "de") {
    return `${count} ${count === 1 ? "Nachricht" : "Nachrichten"}`;
  }

  return `${count} message${count === 1 ? "" : "s"}`;
}



