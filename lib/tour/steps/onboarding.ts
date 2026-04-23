import type { TourStep } from "@/lib/tour/step-types";

/**
 * Simplified visual-only onboarding tour.
 *
 * Four steps narrate the main surfaces a new user needs to know about:
 * Dashboard → Packs list → Tutorial Box detail → Coin Shop (/balance).
 * Every step uses `click-next` — the tour doesn't trigger real purchases
 * or pack opens. Users can bail at any time.
 *
 * The tutorial box is hidden from the normal `/packs` list (client-side
 * filter) and only surfaces while this tour is active, so non-tour users
 * don't stumble into it.
 *
 * Completing the tour once grants a 10-coin reward via
 * /api/me/tour/complete. The grant is gated by `tour.rewardGrantedAt`,
 * so replays of the tour are welcome but pay no additional bonus.
 *
 * Placeholders: `{lang}` and `{tutorialSlug}` (fetched from
 * /api/tutorial-box at tour start).
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
        body: "Ich zeig dir in 4 kurzen Schritten die wichtigsten Bereiche. Am Ende gibt's 10 Coins als Dankeschön — einmalig pro Account.",
        nextLabel: "Los geht's",
      },
      en: {
        title: "Welcome to PACKATTACK ✨",
        body: "I'll walk you through the four most important areas in a minute. Finish the tour once and you'll get 10 coins as a thank-you — one-time only.",
        nextLabel: "Let's go",
      },
    },
    copyOnReplay: {
      de: {
        body: "Kleiner Frische-Rundgang durch die vier Hauptbereiche. Die 10-Coin-Belohnung hast du schon beim ersten Mal bekommen — diesmal nur zum Nachsehen.",
      },
      en: {
        body: "A quick refresher through the four main areas. You already claimed the 10-coin reward on your first run — this time it's just the walkthrough.",
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
        body: "Hier findest du alle verfügbaren Packs. Jede Box hat eigene Karten und Chancen. Für die Tour ist zusätzlich eine Tutorial-Box eingeblendet — die schauen wir als Nächstes an.",
        nextLabel: "Tutorial-Box öffnen",
      },
      en: {
        title: "The packs page",
        body: "Every available pack lives here — each with its own pool and odds. For the tour there's an extra tutorial box pinned to the list. We'll look at it next.",
        nextLabel: "Open tutorial box",
      },
    },
  },
  {
    id: "tour-tutorial-box",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="pack-buy-button"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    waitTimeoutMs: 5000,
    copy: {
      de: {
        title: "Die Tutorial-Box",
        body: "So sieht eine Box-Detailseite aus: Preis, Inhalt, Chancen auf einen Blick. Wenn du ein Pack öffnest, entscheidest du pro Karte — in Coins umwandeln oder in den Warenkorb (3 h reserviert, danach automatisch Coins). Jetzt weiter zum Coin-Shop.",
        nextLabel: "Weiter zum Coin-Shop",
      },
      en: {
        title: "The tutorial box",
        body: "This is a box-detail page: price, contents, odds at a glance. When you open a pack you pick per card — convert to coins or drop into the cart (held 3 h, then auto-converted). Onward to the coin shop.",
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
