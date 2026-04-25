// Translations for the Binder feature. Imported by lib/seed.ts and merged
// into the main translation seed array.
//
// Components currently render strings via inline `lang === "de" ? ... : ...`
// (same pattern as packs/page.tsx). Seeding these keys means admins can
// override copy through /admin/translations without a deploy.

export const binderTranslationSeed = [
  // Sammlung-Seite
  { namespace: "binders", key: "collectionTitle", values: { de: "Sammlung", en: "Collection" } },
  { namespace: "binders", key: "collectionSubtitle", values: { de: "Alle Karten aus deinen Battles und Pack-Öffnungen.", en: "Every card you won in battles and pack openings." } },
  { namespace: "binders", key: "collectionSearchPlaceholder", values: { de: "Nach Karte suchen…", en: "Search card…" } },
  { namespace: "binders", key: "collectionAllTcgs", values: { de: "Alle TCGs", en: "All TCGs" } },
  { namespace: "binders", key: "collectionAllRarities", values: { de: "Alle Raritäten", en: "All rarities" } },
  { namespace: "binders", key: "collectionOnlyFree", values: { de: "Nur freie", en: "Only free" } },
  { namespace: "binders", key: "collectionEmpty", values: { de: "Noch keine Karten. Öffne ein Pack oder gewinn ein Battle.", en: "No cards yet. Open a pack or win a battle." } },
  { namespace: "binders", key: "collectionLoadMore", values: { de: "Mehr laden", en: "Load more" } },
  { namespace: "binders", key: "collectionInBinder", values: { de: "im Binder", en: "in binder" } },

  // Binder-Liste
  { namespace: "binders", key: "listTitle", values: { de: "Deine Binder", en: "Your binders" } },
  { namespace: "binders", key: "listSubtitle", values: { de: "Sammelalben aus deiner Sammlung.", en: "Albums built from your collection." } },
  { namespace: "binders", key: "listNew", values: { de: "Neuer Binder", en: "New binder" } },
  { namespace: "binders", key: "listExplore", values: { de: "Galerie entdecken", en: "Discover gallery" } },
  { namespace: "binders", key: "listEmpty", values: { de: "Noch kein Binder. Leg deinen ersten an!", en: "No binders yet. Start your first one!" } },
  { namespace: "binders", key: "listFirstCta", values: { de: "Leg deinen ersten Binder an", en: "Start your first binder" } },
  { namespace: "binders", key: "tagFree", values: { de: "Frei", en: "Free" } },
  { namespace: "binders", key: "tagSet", values: { de: "Set", en: "Set" } },
  { namespace: "binders", key: "tagPublic", values: { de: "Öffentlich", en: "Public" } },
  { namespace: "binders", key: "tagPrivate", values: { de: "Privat", en: "Private" } },
  { namespace: "binders", key: "noDescription", values: { de: "Keine Beschreibung.", en: "No description." } },

  // Wizard
  { namespace: "binders", key: "wizardTitle", values: { de: "Neuer Binder", en: "New binder" } },
  { namespace: "binders", key: "wizardSubtitle", values: { de: "In drei Schritten zu deinem eigenen Sammelalbum.", en: "Build your own album in three steps." } },
  { namespace: "binders", key: "wizardStepType", values: { de: "Welche Art Binder?", en: "What kind of binder?" } },
  { namespace: "binders", key: "wizardStepSet", values: { de: "Welches Set?", en: "Which set?" } },
  { namespace: "binders", key: "wizardTypeFree", values: { de: "Frei", en: "Free" } },
  { namespace: "binders", key: "wizardTypeFreeDesc", values: { de: "Leerer Binder. Du entscheidest alles selbst.", en: "Empty binder. You decide everything." } },
  { namespace: "binders", key: "wizardTypeSet", values: { de: "Set-Template", en: "Set template" } },
  { namespace: "binders", key: "wizardTypeSetDesc", values: { de: "Slots sind nach einem Set vorbereitet, Vollständigkeit wird gezählt.", en: "Slots are pre-allocated for a set, completion is tracked." } },
  { namespace: "binders", key: "wizardName", values: { de: "Name", en: "Name" } },
  { namespace: "binders", key: "wizardNamePlaceholder", values: { de: "z. B. Mein erster Binder", en: "e.g. My first binder" } },
  { namespace: "binders", key: "wizardDescription", values: { de: "Beschreibung", en: "Description" } },
  { namespace: "binders", key: "wizardDescriptionPlaceholder", values: { de: "Worum geht es in diesem Binder?", en: "What is this binder about?" } },
  { namespace: "binders", key: "wizardTheme", values: { de: "Theme", en: "Theme" } },
  { namespace: "binders", key: "wizardSubmit", values: { de: "Binder anlegen", en: "Create binder" } },
  { namespace: "binders", key: "wizardSubmitting", values: { de: "Wird angelegt…", en: "Creating…" } },
  { namespace: "binders", key: "wizardPickSet", values: { de: "Bitte ein Set wählen.", en: "Please pick a set." } },
  { namespace: "binders", key: "wizardNeedName", values: { de: "Bitte einen Namen angeben.", en: "Please give it a name." } },

  // Editor
  { namespace: "binders", key: "editorBack", values: { de: "Binder", en: "Binders" } },
  { namespace: "binders", key: "editorSettings", values: { de: "Einstellungen", en: "Settings" } },
  { namespace: "binders", key: "editorSaving", values: { de: "Speichert…", en: "Saving…" } },
  { namespace: "binders", key: "editorPage", values: { de: "Seite", en: "Page" } },
  { namespace: "binders", key: "editorCards", values: { de: "Karten", en: "cards" } },
  { namespace: "binders", key: "editorPagesShort", values: { de: "Seiten", en: "pages" } },
  { namespace: "binders", key: "editorPrev", values: { de: "Vorherige Seite", en: "Previous page" } },
  { namespace: "binders", key: "editorNext", values: { de: "Nächste Seite", en: "Next page" } },
  { namespace: "binders", key: "editorPageTitlePlaceholder", values: { de: "Seitentitel", en: "Page title" } },

  // Inventory drawer
  { namespace: "binders", key: "inventoryTitle", values: { de: "Inventar", en: "Inventory" } },
  { namespace: "binders", key: "inventoryEmpty", values: { de: "Keine freien Karten. Alle sind in einem Binder oder du hast noch keine.", en: "No free cards. All in a binder or none yet." } },

  // Settings sheet
  { namespace: "binders", key: "settingsTitle", values: { de: "Einstellungen", en: "Settings" } },
  { namespace: "binders", key: "settingsCover", values: { de: "Cover", en: "Cover" } },
  { namespace: "binders", key: "settingsCoverEmpty", values: { de: "Erst Karten in den Binder legen, dann kannst du eine als Cover wählen.", en: "Place cards in the binder first, then pick one as cover." } },
  { namespace: "binders", key: "settingsCoverNone", values: { de: "Kein Cover", en: "No cover" } },
  { namespace: "binders", key: "settingsPublic", values: { de: "Öffentlich", en: "Public" } },
  { namespace: "binders", key: "settingsPublicHint", values: { de: "Andere können den Binder über einen Link öffnen und in der Galerie entdecken.", en: "Others can open this binder via link and find it in the gallery." } },
  { namespace: "binders", key: "settingsDelete", values: { de: "Binder löschen", en: "Delete binder" } },
  { namespace: "binders", key: "settingsDeleteConfirm", values: { de: "Binder \"{{name}}\" wirklich löschen? Karten gehen zurück in deine Sammlung.", en: "Delete binder \"{{name}}\"? Cards return to your collection." } },
  { namespace: "binders", key: "settingsCancel", values: { de: "Abbrechen", en: "Cancel" } },
  { namespace: "binders", key: "settingsSave", values: { de: "Speichern", en: "Save" } },
  { namespace: "binders", key: "settingsSaved", values: { de: "Gespeichert.", en: "Saved." } },
  { namespace: "binders", key: "shareCopy", values: { de: "Kopieren", en: "Copy" } },
  { namespace: "binders", key: "shareCopied", values: { de: "Kopiert", en: "Copied" } },
  { namespace: "binders", key: "shareCopyToast", values: { de: "Link kopiert.", en: "Link copied." } },

  // Slot note popover
  { namespace: "binders", key: "slotNoteTitle", values: { de: "Notiz für diesen Slot", en: "Note for this slot" } },
  { namespace: "binders", key: "slotNotePlaceholder", values: { de: "z. B. mein erster Charizard, aus Battle vs. Max", en: "e.g. my first Charizard, from battle vs. Max" } },
  { namespace: "binders", key: "slotRemoveCard", values: { de: "Karte zurück ins Inventar", en: "Card back to inventory" } },

  // Set-template completion
  { namespace: "binders", key: "completionMatched", values: { de: "Karten gefunden", en: "cards matched" } },
  { namespace: "binders", key: "completionDone", values: { de: "Set komplett — Glückwunsch!", en: "Set complete — congrats!" } },

  // Discover gallery
  { namespace: "binders", key: "exploreTitle", values: { de: "Binder entdecken", en: "Discover binders" } },
  { namespace: "binders", key: "exploreSubtitle", values: { de: "Was die Community so kuratiert.", en: "What the community curates." } },
  { namespace: "binders", key: "exploreSortRecent", values: { de: "Neueste", en: "Recent" } },
  { namespace: "binders", key: "exploreSortTop", values: { de: "Top", en: "Top" } },
  { namespace: "binders", key: "exploreEmpty", values: { de: "Noch nichts veröffentlicht. Setz einen deiner Binder auf öffentlich!", en: "Nothing published yet. Make one of yours public!" } },
  { namespace: "binders", key: "exploreMore", values: { de: "Mehr", en: "More" } },

  // Public viewer
  { namespace: "binders", key: "publicGallery", values: { de: "Galerie", en: "Gallery" } },

  // Generic toasts
  { namespace: "binders", key: "loadFailed", values: { de: "Konnte nicht laden.", en: "Could not load." } },
  { namespace: "binders", key: "actionFailed", values: { de: "Aktion fehlgeschlagen.", en: "Action failed." } },
  { namespace: "binders", key: "networkError", values: { de: "Netzwerkfehler.", en: "Network error." } },
  { namespace: "binders", key: "saveFailed", values: { de: "Konnte nicht speichern.", en: "Could not save." } },
  { namespace: "binders", key: "deleteFailed", values: { de: "Konnte nicht löschen.", en: "Could not delete." } },
  { namespace: "binders", key: "copyFailed", values: { de: "Konnte nicht kopieren.", en: "Could not copy." } },
  { namespace: "binders", key: "loginToLike", values: { de: "Bitte einloggen.", en: "Please sign in." } },

  // Sidebar
  { namespace: "common", key: "navCollection", values: { de: "Sammlung", en: "Collection" } },
  { namespace: "common", key: "navBinders", values: { de: "Binder", en: "Binders" } },

  // Header top-level + mega-menu items
  { namespace: "common", key: "collection", values: { de: "Sammlung", en: "Collection" } },
  { namespace: "common", key: "my_collection", values: { de: "Meine Sammlung", en: "My collection" } },
  { namespace: "common", key: "my_collection_desc", values: { de: "Alle Karten, die dir gehören", en: "Every card you own" } },
  { namespace: "common", key: "binders", values: { de: "Binder", en: "Binders" } },
  { namespace: "common", key: "binders_desc", values: { de: "Sammelalben aus deinen Karten", en: "Albums built from your cards" } },
  { namespace: "common", key: "binders_explore", values: { de: "Binder-Galerie", en: "Binder gallery" } },
  { namespace: "common", key: "binders_explore_desc", values: { de: "Was die Community kuratiert", en: "What the community curates" } },
];
