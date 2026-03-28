export interface ChatUiCopy {
  page: {
    title: string;
    subtitle: string;
    roomTitle: string;
    roomSubtitle: string;
    online: string;
    onlineUsersTitle: string;
    onlineUsersEmpty: string;
    onlineUsersLoadError: string;
    collapse: string;
    expand: string;
    rulesTitle: string;
    rulesBody: string;
    archiveNote: string;
    loading: string;
    empty: string;
    newMessages: string;
  };
  composer: {
    placeholder: string;
    send: string;
    sending: string;
    gifsUnavailable: string;
    verificationRequired: string;
    linkAdminOnly: string;
    readOnly: string;
    announcementOnly: string;
    timeoutActive: string;
    banned: string;
    blocked: string;
    moderationUnavailable: string;
    rateLimited: string;
    slowMode: string;
    shortcutHint: string;
  };
  sounds: {
    label: string;
    off: string;
    all: string;
    mentionsOnly: string;
    mentionsAndStaff: string;
    badgeOff: string;
    badgeAll: string;
    badgeMentionsOnly: string;
    badgeMentionsAndStaff: string;
    saved: string;
  };
  gifs: {
    title: string;
    button: string;
    searchPlaceholder: string;
    favorites: string;
    attached: string;
    removeAttachment: string;
    saveFavorite: string;
    removeFavorite: string;
    emptyTrending: string;
    emptySearch: string;
    emptyFavorites: string;
    loadMore: string;
    loadError: string;
    favoriteError: string;
    poweredBy: string;
  };
  reports: {
    title: string;
    description: string;
    submit: string;
    cancel: string;
    spam: string;
    scam: string;
    hate: string;
    harassment: string;
    sexual: string;
    pii: string;
    other: string;
    success: string;
    error: string;
  };
  states: {
    networkError: string;
    loadError: string;
    deleted: string;
    held: string;
    adminLinksOnly: string;
    verificationOnly: string;
    soundUnavailable: string;
  };
  admin: {
    title: string;
    subtitle: string;
    liveFeed: string;
    activeRestrictions: string;
    restrictionsSubtitle: string;
    userSearch: string;
    auditLog: string;
    review: string;
    quickActions: string;
    heldQueue: string;
    heldQueueDescription: string;
    reportsQueue: string;
    controls: string;
    allRestrictions: string;
    allActions: string;
    roomMode: string;
    slowMode: string;
    apply: string;
    approve: string;
    reject: string;
    delete: string;
    restore: string;
    timeout: string;
    ban: string;
    unban: string;
    shadowMute: string;
    unshadowMute: string;
    liftTimeout: string;
    liftBan: string;
    liftShadowMute: string;
    reason: string;
    minutes: string;
    refresh: string;
    imposedBy: string;
    imposedAt: string;
    expiresAt: string;
    targetFilter: string;
    actorFilter: string;
    from: string;
    to: string;
    currentRestriction: string;
    recentMessages: string;
    noHeld: string;
    noReports: string;
    noRestrictions: string;
    noUsers: string;
    noReason: string;
    noSourceContext: string;
    sourceMessage: string;
    protectedUser: string;
    recentActions: string;
    noActions: string;
    timeoutDuration: string;
    timeoutManual: string;
    invalidDuration: string;
  };
  roomModes: {
    open: string;
    read_only: string;
    slow_mode: string;
    announcement_only: string;
  };
  badges: {
    verified: string;
  };
}

const de: ChatUiCopy = {
  page: {
    title: "Chat",
    subtitle: "Der öffentliche Live-Chat für alle verifizierten Nutzer und Admins.",
    roomTitle: "Globaler Chat",
    roomSubtitle: "Ein gemeinsamer Raum für alle. Nachrichten werden dauerhaft archiviert.",
    online: "Online",
    onlineUsersTitle: "Aktive Nutzer im Chat",
    onlineUsersEmpty: "Aktuell ist niemand im Chat sichtbar.",
    onlineUsersLoadError: "Onlineliste konnte nicht geladen werden.",
    collapse: "Schließen",
    expand: "Öffnen",
    rulesTitle: "Wichtig",
    rulesBody: "Nur Admins dürfen Links posten. Beleidigungen, PII, Spam und Umgehungsversuche sind nicht erlaubt.",
    archiveNote: "Jede Nachricht und jede Moderationsaktion wird dauerhaft archiviert.",
    loading: "Chat wird geladen...",
    empty: "Noch keine Nachrichten.",
    newMessages: "Neue Nachrichten",
  },
  composer: {
    placeholder: "Schreibe eine Nachricht...",
    send: "Senden",
    sending: "Wird gesendet...",
    gifsUnavailable: "GIFs sind gerade nicht verfügbar.",
    verificationRequired: "Du musst deine E-Mail bestätigen, um im Chat zu schreiben.",
    linkAdminOnly: "Links sind nur für Admins erlaubt.",
    readOnly: "Der Chat ist aktuell schreibgeschützt.",
    announcementOnly: "Der Chat ist aktuell nur für Ankündigungen geöffnet.",
    timeoutActive: "Du bist vorübergehend vom Chat ausgeschlossen.",
    banned: "Du bist für den Chat gesperrt.",
    blocked: "Diese Nachricht wurde von der Moderation blockiert.",
    moderationUnavailable: "Der Chat ist vorübergehend nur lesbar, bis die Moderation aktiv ist.",
    rateLimited: "Bitte warte kurz, bevor du erneut schreibst.",
    slowMode: "Slow Mode aktiv",
    shortcutHint: "Enter senden · Shift+Enter Zeilenumbruch",
  },
  sounds: {
    label: "Ton",
    off: "Aus",
    all: "Alle Nachrichten",
    mentionsOnly: "Nur Erwähnungen",
    mentionsAndStaff: "Erwähnungen + Admins",
    badgeOff: "Aus",
    badgeAll: "Alle",
    badgeMentionsOnly: "Erwähn.",
    badgeMentionsAndStaff: "Erw. + Team",
    saved: "Toneinstellung gespeichert",
  },
  gifs: {
    title: "GIF auswählen",
    button: "GIF",
    searchPlaceholder: "GIFs durchsuchen...",
    favorites: "Favoriten",
    attached: "Angehängtes GIF",
    removeAttachment: "GIF entfernen",
    saveFavorite: "Zu Favoriten hinzufügen",
    removeFavorite: "Aus Favoriten entfernen",
    emptyTrending: "Keine Trending-GIFs verfügbar.",
    emptySearch: "Keine GIFs für diese Suche gefunden.",
    emptyFavorites: "Du hast noch keine gespeicherten GIFs.",
    loadMore: "Mehr laden",
    loadError: "GIFs konnten nicht geladen werden.",
    favoriteError: "Favoriten konnten nicht aktualisiert werden.",
    poweredBy: "Powered by GIPHY",
  },
  reports: {
    title: "Nachricht melden",
    description: "Wähle den passenden Grund aus. Meldungen werden im Admin-Bereich geprüft.",
    submit: "Melden",
    cancel: "Abbrechen",
    spam: "Spam",
    scam: "Betrug",
    hate: "Hassrede",
    harassment: "Belästigung",
    sexual: "Sexuelle Inhalte",
    pii: "Persönliche Daten",
    other: "Sonstiges",
    success: "Nachricht gemeldet",
    error: "Meldung konnte nicht gespeichert werden",
  },
  states: {
    networkError: "Netzwerkfehler",
    loadError: "Chat konnte nicht geladen werden",
    deleted: "Nachricht entfernt",
    held: "Nachricht wird geprüft",
    adminLinksOnly: "Links sind nur für Admins erlaubt.",
    verificationOnly: "Nur verifizierte Nutzer dürfen schreiben.",
    soundUnavailable: "Ton konnte nicht abgespielt werden.",
  },
  admin: {
    title: "Chat-Verwaltung",
    subtitle: "Moderation, gemeldete Nachrichten und Raumsteuerung für den globalen Chat.",
    liveFeed: "Live-Feed",
    activeRestrictions: "Aktive Einschränkungen",
    restrictionsSubtitle: "Alle aktuellen Timeouts, Sperren und Shadow Mutes mit Grund und Kontext.",
    userSearch: "Nutzersuche",
    auditLog: "Sanktionslog",
    review: "Moderationsqueue",
    quickActions: "Schnellmoderation",
    heldQueue: "Zur Prüfung zurückgehaltene Nachrichten",
    heldQueueDescription:
      "Diese Nachrichten wurden von der Moderation angehalten und müssen freigegeben oder abgelehnt werden.",
    reportsQueue: "Meldungen",
    controls: "Raumsteuerung",
    allRestrictions: "Alle Einschränkungen",
    allActions: "Alle Sanktionen",
    roomMode: "Modus",
    slowMode: "Slow Mode (Sekunden)",
    apply: "Übernehmen",
    approve: "Freigeben",
    reject: "Ablehnen",
    delete: "Löschen",
    restore: "Wiederherstellen",
    timeout: "Timeout",
    ban: "Sperren",
    unban: "Entsperren",
    shadowMute: "Shadow Mute",
    unshadowMute: "Shadow Mute entfernen",
    liftTimeout: "Timeout aufheben",
    liftBan: "Sperre aufheben",
    liftShadowMute: "Shadow Mute aufheben",
    reason: "Grund",
    minutes: "Minuten",
    refresh: "Aktualisieren",
    imposedBy: "Verhängt von",
    imposedAt: "Verhängt am",
    expiresAt: "Läuft ab",
    targetFilter: "Betroffener Nutzer",
    actorFilter: "Ausgeführt von",
    from: "Von",
    to: "Bis",
    currentRestriction: "Aktueller Status",
    recentMessages: "Letzte Nachrichten",
    noHeld: "Aktuell gibt es keine zurückgehaltenen Nachrichten.",
    noReports: "Keine offenen Meldungen.",
    noRestrictions: "Keine aktiven Einschränkungen.",
    noUsers: "Keine Nutzer gefunden.",
    noReason: "Kein Grund angegeben.",
    noSourceContext: "Kein Nachrichtenkontext vorhanden.",
    sourceMessage: "Auslösende Nachricht",
    protectedUser: "Admins und Moderatoren können hier nicht sanktioniert werden.",
    recentActions: "Letzte Aktionen",
    noActions: "Noch keine Moderationsaktionen.",
    timeoutDuration: "Dauer",
    timeoutManual: "Manuell",
    invalidDuration: "Bitte gib eine gültige Timeout-Dauer ein.",
  },
  roomModes: {
    open: "Offen",
    read_only: "Schreibgeschützt",
    slow_mode: "Slow Mode",
    announcement_only: "Nur Ankündigungen",
  },
  badges: {
    verified: "VERIFIZIERT",
  },
};

const en: ChatUiCopy = {
  page: {
    title: "Chat",
    subtitle: "The public live chat for all verified users and admins.",
    roomTitle: "Global Chat",
    roomSubtitle: "One shared room for everyone. Messages are archived permanently.",
    online: "Online",
    onlineUsersTitle: "Users currently in chat",
    onlineUsersEmpty: "No users are currently visible in chat.",
    onlineUsersLoadError: "Could not load the online user list.",
    collapse: "Close",
    expand: "Open",
    rulesTitle: "Important",
    rulesBody: "Only admins may post links. Abuse, PII, spam, and evasion attempts are not allowed.",
    archiveNote: "Every message and moderation action is archived permanently.",
    loading: "Loading chat...",
    empty: "No messages yet.",
    newMessages: "New messages",
  },
  composer: {
    placeholder: "Write a message...",
    send: "Send",
    sending: "Sending...",
    gifsUnavailable: "GIFs are currently unavailable.",
    verificationRequired: "You must verify your email to post in chat.",
    linkAdminOnly: "Links are only allowed for admins.",
    readOnly: "Chat is currently read-only.",
    announcementOnly: "Chat is currently restricted to announcements.",
    timeoutActive: "You are temporarily timed out from chat.",
    banned: "You are banned from chat.",
    blocked: "This message was blocked by moderation.",
    moderationUnavailable: "Chat is temporarily read-only until moderation is active.",
    rateLimited: "Please wait a moment before sending another message.",
    slowMode: "Slow mode active",
    shortcutHint: "Enter to send · Shift+Enter for a new line",
  },
  sounds: {
    label: "Sound",
    off: "Off",
    all: "All messages",
    mentionsOnly: "Mentions only",
    mentionsAndStaff: "Mentions + staff",
    badgeOff: "Off",
    badgeAll: "All",
    badgeMentionsOnly: "Mentions",
    badgeMentionsAndStaff: "Mentions + staff",
    saved: "Sound preference saved",
  },
  gifs: {
    title: "Choose a GIF",
    button: "GIF",
    searchPlaceholder: "Search GIFs...",
    favorites: "Favorites",
    attached: "Attached GIF",
    removeAttachment: "Remove GIF",
    saveFavorite: "Save to favorites",
    removeFavorite: "Remove from favorites",
    emptyTrending: "No trending GIFs are available right now.",
    emptySearch: "No GIFs matched this search.",
    emptyFavorites: "You have not saved any GIFs yet.",
    loadMore: "Load more",
    loadError: "Could not load GIFs.",
    favoriteError: "Could not update favorites.",
    poweredBy: "Powered by GIPHY",
  },
  reports: {
    title: "Report message",
    description: "Choose the most relevant reason. Reports are reviewed in admin.",
    submit: "Report",
    cancel: "Cancel",
    spam: "Spam",
    scam: "Scam",
    hate: "Hate",
    harassment: "Harassment",
    sexual: "Sexual content",
    pii: "Personal data",
    other: "Other",
    success: "Message reported",
    error: "Could not save report",
  },
  states: {
    networkError: "Network error",
    loadError: "Failed to load chat",
    deleted: "Message removed",
    held: "Message is under review",
    adminLinksOnly: "Links are only allowed for admins.",
    verificationOnly: "Only verified users may post.",
    soundUnavailable: "Sound could not be played.",
  },
  admin: {
    title: "Chat Admin",
    subtitle: "Moderation, reports, and room controls for the global chat.",
    liveFeed: "Live feed",
    activeRestrictions: "Active restrictions",
    restrictionsSubtitle: "Current timeouts, bans, and shadow mutes with reason and source context.",
    userSearch: "User search",
    auditLog: "Sanction log",
    review: "Moderation queue",
    quickActions: "Quick moderation",
    heldQueue: "Held messages awaiting review",
    heldQueueDescription:
      "These messages were stopped by moderation and need to be approved or rejected.",
    reportsQueue: "Reports",
    controls: "Room controls",
    allRestrictions: "All restrictions",
    allActions: "All sanctions",
    roomMode: "Mode",
    slowMode: "Slow mode (seconds)",
    apply: "Apply",
    approve: "Approve",
    reject: "Reject",
    delete: "Delete",
    restore: "Restore",
    timeout: "Timeout",
    ban: "Ban",
    unban: "Unban",
    shadowMute: "Shadow mute",
    unshadowMute: "Remove shadow mute",
    liftTimeout: "Lift timeout",
    liftBan: "Lift ban",
    liftShadowMute: "Lift shadow mute",
    reason: "Reason",
    minutes: "Minutes",
    refresh: "Refresh",
    imposedBy: "Imposed by",
    imposedAt: "Imposed at",
    expiresAt: "Expires at",
    targetFilter: "Affected user",
    actorFilter: "Performed by",
    from: "From",
    to: "To",
    currentRestriction: "Current status",
    recentMessages: "Recent messages",
    noHeld: "There are currently no held messages awaiting review.",
    noReports: "No open reports.",
    noRestrictions: "No active restrictions.",
    noUsers: "No users found.",
    noReason: "No reason provided.",
    noSourceContext: "No source message context available.",
    sourceMessage: "Source message",
    protectedUser: "Admins and moderators cannot be restricted here.",
    recentActions: "Recent actions",
    noActions: "No moderation actions yet.",
    timeoutDuration: "Duration",
    timeoutManual: "Manual",
    invalidDuration: "Please enter a valid timeout duration.",
  },
  roomModes: {
    open: "Open",
    read_only: "Read only",
    slow_mode: "Slow mode",
    announcement_only: "Announcements only",
  },
  badges: {
    verified: "VERIFIED",
  },
};

export function getChatCopy(lang: string): ChatUiCopy {
  return lang === "de" ? de : en;
}



