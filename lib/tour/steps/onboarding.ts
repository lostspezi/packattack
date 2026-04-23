import type { TourStep } from "@/lib/tour/step-types";

/**
 * Visual-only onboarding tour. Every step uses `click-next` — nothing
 * triggers real purchases or pack opens. Users can skip anytime.
 *
 * The tutorial box is filtered out of the normal /packs list unless the
 * tour is active, so non-tour users don't stumble into it; the detail
 * route remains reachable by direct URL.
 *
 * Completing the tour once grants a 10-coin reward via
 * /api/me/tour/complete. The grant is gated by `tour.rewardGrantedAt`
 * so replays are free of additional bonuses. When the user replays
 * after having claimed the reward, `copyOnReplay` overrides suppress
 * the "10 coins" promise on the welcome and balance steps.
 *
 * Placeholders: `{lang}` and `{tutorialSlug}` (the latter is fetched
 * from /api/tutorial-box at tour start).
 */
export const ONBOARDING_STEPS: TourStep[] = [
  {
    id: "tour-welcome",
    route: "/{lang}/dashboard",
    selector: '[data-tour="dashboard-welcome"]',
    placement: "bottom",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Willkommen bei PACKATTACK ✨",
        body: "Ich zeig dir in ein paar kurzen Schritten die wichtigsten Bereiche. Am Ende gibt's 10 Coins als Dankeschön — einmalig pro Account.",
        nextLabel: "Los geht's",
      },
      en: {
        title: "Welcome to PACKATTACK ✨",
        body: "I'll walk you through the most important areas in a few short steps. Finish the tour once and you'll get 10 coins as a thank-you — one-time only.",
        nextLabel: "Let's go",
      },
    },
    copyOnReplay: {
      de: {
        body: "Kleiner Frische-Rundgang durch die Hauptbereiche. Die 10-Coin-Belohnung hast du schon beim ersten Mal bekommen — diesmal nur zum Nachsehen.",
      },
      en: {
        body: "A quick refresher through the main areas. You already claimed the 10-coin reward on your first run — this time it's just the walkthrough.",
      },
    },
  },
  {
    id: "tour-packs",
    route: "/{lang}/packs",
    selector: '[data-tour="packs-grid"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Die Packs-Seite",
        body: "Hier findest du alle verfügbaren Packs. Jede Box hat eigene Karten und Chancen. Für die Tour ist zusätzlich eine Tutorial-Box eingeblendet — die schauen wir uns als Nächstes im Detail an.",
        nextLabel: "Tutorial-Box öffnen",
      },
      en: {
        title: "The packs page",
        body: "Every available pack lives here — each with its own pool and odds. For the tour there's an extra tutorial box pinned to the list. We'll look at it in detail next.",
        nextLabel: "Open tutorial box",
      },
    },
  },
  {
    id: "tour-box-buy",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="pack-buy-button"]',
    placement: "bottom",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 6000,
    copy: {
      de: {
        title: "Pack öffnen",
        body: "Hier klickst du, um ein Pack zu kaufen und direkt zu öffnen. Der Preis steht rechts auf dem Button — bei diesem Pack 10 Coins. Abgebucht wird erst nach deiner Bestätigung im nächsten Dialog.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Open a pack",
        body: "Click here to buy a pack and open it right away. The price sits on the button — this one's 10 coins. Coins are only deducted once you confirm in the follow-up dialog.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-box-condition",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-condition"]',
    placement: "left",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Zustand der Karten",
        body: "Zeigt, in welchen Zuständen die Karten vorkommen: Mint (perfekt), Near Mint (fast perfekt), Lightly / Moderately / Heavily Played. Besserer Zustand = höherer Coin-Gegenwert beim Umwandeln.",
        nextLabel: "Verstanden",
      },
      en: {
        title: "Card condition",
        body: "Shows the conditions cards come in: Mint (perfect), Near Mint, Lightly / Moderately / Heavily Played. Better condition = higher coin payout when converting.",
        nextLabel: "Got it",
      },
    },
  },
  {
    id: "tour-box-rarities",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-rarities"]',
    placement: "left",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Raritäten-Verteilung",
        body: "Jede Rarität hat eine eigene Gesamt-Chance in dieser Box. Je seltener, desto kleiner der Prozentbalken — aber auch desto wertvoller der Pull. Die Raritäten-Namen variieren je nach Kartenspiel.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Rarity distribution",
        body: "Each rarity has its own total drop chance in this box. Rarer = smaller bar — and usually more valuable when pulled. Names vary by TCG.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-box-top-hits",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-top-hits"]',
    placement: "right",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Top Hits",
        body: "Die drei wertvollsten Karten dieser Box. Das sind die Chase-Cards — auf die hofft jeder. Die kleinen Icons zeigen, ob du sie schon gezogen hast.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Top hits",
        body: "The three most valuable cards in this box — the chase cards everyone hopes for. The tiny icons show whether you've pulled them yet.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-box-live-pulls",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-live-pulls"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Live Pulls",
        body: "Was andere User gerade aus dieser Box ziehen, in Echtzeit. Gute Orientierung wie oft wirklich Top-Karten kommen — und ziemlich hypnotisch.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Live pulls",
        body: "What other users are pulling from this box right now, in real time. A solid gut check on how often the big cards actually land — and kind of hypnotic.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-box-my-pulls",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-my-pulls"]',
    placement: "left",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Meine letzten Pulls",
        body: "Deine eigene Pull-Historie für diese Box. Behältst du den Überblick was du schon gezogen hast und was dir noch fehlt.",
        nextLabel: "Weiter",
      },
      en: {
        title: "My recent pulls",
        body: "Your own pull history for this box. Keeps tabs on what you've already got and what's still missing.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "tour-box-card",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="box-first-card"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Einzel-Chance pro Karte",
        body: "Unter jeder Karte steht ihre individuelle Zieh-Chance. Die grüne Zahl heißt häufig, gelb eher selten, rot sehr selten. Klick auf eine Karte öffnet Details mit Marktpreis und Coin-Wert.",
        nextLabel: "Weiter zum Coin-Shop",
      },
      en: {
        title: "Per-card pull chance",
        body: "Each card shows its individual pull chance underneath. Green = common, yellow = uncommon, red = rare. Click a card to open details with market price and coin value.",
        nextLabel: "On to the coin shop",
      },
    },
  },
  {
    id: "tour-balance",
    route: "/{lang}/balance",
    selector: '[data-tour="balance-topup"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 4000,
    copy: {
      de: {
        title: "Coin-Shop — fertig 🎴",
        body: "Leere Coins lädst du hier mit Echtgeld auf. Das war's! Als Dankeschön landen gleich 10 Coins in deinem Guthaben. Viel Spaß beim Sammeln — du erreichst mich jederzeit über Packi unten links.",
        nextLabel: "Belohnung abholen",
      },
      en: {
        title: "Coin shop — all done 🎴",
        body: "Refill coins here with real money. That's it! 10 coins are landing in your balance now as a thank-you. Happy collecting — ping me anytime via Packi bottom-left.",
        nextLabel: "Claim reward",
      },
    },
    copyOnReplay: {
      de: {
        title: "Coin-Shop — alles klar",
        body: "Leere Coins lädst du hier mit Echtgeld auf. Das war die Tour. Viel Spaß beim Sammeln — du erreichst mich jederzeit über Packi unten links.",
        nextLabel: "Fertig",
      },
      en: {
        title: "Coin shop — all set",
        body: "Refill coins here with real money. That's the walkthrough. Happy collecting — ping me anytime via Packi bottom-left.",
        nextLabel: "Done",
      },
    },
  },
];
