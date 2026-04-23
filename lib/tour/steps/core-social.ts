import type { TourStep } from "@/lib/tour/step-types";

export const CORE_SOCIAL_STEPS: TourStep[] = [
  {
    id: "dashboard-welcome",
    route: "/{lang}/dashboard",
    selector: '[data-tour="dashboard-welcome"]',
    placement: "bottom",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Hey, ich bin Packi ✨",
        body: "Ich zeig dir in ~10 kurzen Schritten, wie PACKATTACK funktioniert. Skip geht jederzeit.",
        nextLabel: "Los geht's",
      },
      en: {
        title: "Hey, I'm Packi ✨",
        body: "Let me walk you through PACKATTACK in about 10 quick steps. You can skip anytime.",
        nextLabel: "Let's go",
      },
    },
  },
  {
    id: "packs-browse",
    route: "/{lang}/packs",
    selector: '[data-tour="packs-grid"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    copy: {
      de: {
        title: "Das sind die Packs",
        body: "Hier findest du alle verfügbaren Packs. Jedes hat eine eigene Karten-Liste und eine Chance-Übersicht.",
        nextLabel: "Weiter",
      },
      en: {
        title: "These are the packs",
        body: "Every available pack lives here — each with its own card pool and a chance breakdown.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "pack-buy",
    route: "/{lang}/packs",
    selector: '[data-tour="pack-buy"]',
    placement: "right",
    nextTrigger: { type: "click-next" },
    copy: {
      de: {
        title: "Pack kaufen",
        body: "Klick hier um ein Pack mit Coins zu kaufen. Coins kriegst du über Events, Shops und Challenges.",
        nextLabel: "Verstanden",
      },
      en: {
        title: "Buy a pack",
        body: "Click here to buy a pack with coins. Coins come from events, the shop, and challenges.",
        nextLabel: "Got it",
      },
    },
  },
  {
    id: "pack-open",
    route: "/{lang}/packs",
    selector: '[data-tour="pack-open"]',
    placement: "bottom",
    waitTimeoutMs: 6000,
    nextTrigger: { type: "event", event: "pack-opened" },
    targetOptional: true,
    copy: {
      de: {
        title: "Pack öffnen",
        body: "Nach dem Kauf findest du deine Packs hier zum Öffnen. Reveal-Animation inklusive 🎴",
        nextLabel: "Weiter",
      },
      en: {
        title: "Open a pack",
        body: "After buying, open packs from here. Reveal animation included 🎴",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "collection-view",
    route: "/{lang}/profile",
    selector: '[data-tour="collection"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Deine Sammlung",
        body: "Alle gezogenen Karten landen hier in deinem Profil. Filter, Sortierung und Tausch-Offers machst du von hier.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Your collection",
        body: "Every card you pull lands in your profile. Filter, sort, and trade from here.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "chat-entry",
    // Chat lives inside ChatDock on the dashboard layout. /chat itself
    // redirects to /dashboard — route here is dashboard so we don't loop.
    route: "/{lang}/dashboard",
    selector: '[data-tour="chat-panel"]',
    placement: "left",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Community-Chat",
        body: "Rechts im Chat-Dock tauschst du dich mit anderen Sammlern aus. Drei Regeln: kein Spam, kein Beef, keine Real-Money-Deals.",
        nextLabel: "Check",
      },
      en: {
        title: "Community chat",
        body: "The chat dock on the right lets you talk to other collectors. Three rules: no spam, no beef, no real-money deals.",
        nextLabel: "Check",
      },
    },
  },
  {
    id: "chat-input",
    route: "/{lang}/dashboard",
    selector: '[data-tour="chat-input"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Nachricht schreiben",
        body: "Tippen, Enter drücken, fertig. @username erwähnt jemanden direkt.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Send a message",
        body: "Type, press Enter, done. Use @username to mention someone.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "leaderboard",
    route: "/{lang}/leaderboard",
    selector: '[data-tour="leaderboard-list"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Leaderboard",
        body: "Je mehr und seltener du ziehst und je aktiver du bist, desto höher kletterst du hier.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Leaderboard",
        body: "The more and rarer you pull, and the more active you are, the higher you climb.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "profile-edit",
    route: "/{lang}/profile",
    selector: '[data-tour="profile-edit"]',
    placement: "bottom",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Dein Profil",
        body: "Avatar, Bio, Streamer-Mode, Benachrichtigungen — alles hier einstellbar.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Your profile",
        body: "Avatar, bio, streamer mode, notifications — all configurable here.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-complete",
    route: "/{lang}/dashboard",
    selector: '[data-tour="dashboard-welcome"]',
    placement: "bottom",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Du bist bereit! 🎴",
        body: "Frag mich jederzeit über den Sparkle-Button unten links. Viel Spaß beim Sammeln!",
        nextLabel: "Alles klar",
      },
      en: {
        title: "You're all set! 🎴",
        body: "Ping me any time via the sparkle button bottom-left. Happy collecting!",
        nextLabel: "Got it",
      },
    },
  },
];
