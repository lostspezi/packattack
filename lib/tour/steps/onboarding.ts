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
        body: "Kurzer Rundgang durch die wichtigsten Bereiche. Wenn du am Ende angekommen bist, schenk ich dir 10 Coins. Das läuft nur einmal pro Account.",
        nextLabel: "Los geht's",
      },
      en: {
        title: "Welcome to PACKATTACK ✨",
        body: "Quick walkthrough of the main areas. If you make it to the end, I'll give you 10 coins. Happens just once per account.",
        nextLabel: "Let's go",
      },
    },
    copyOnReplay: {
      de: {
        body: "Kleiner Frische-Rundgang. Die 10 Coins hast du beim ersten Mal schon bekommen, diesmal läuft's ohne Belohnung.",
      },
      en: {
        body: "Quick refresher. You already got the 10 coins on your first run, this time it's just for looking around.",
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
        body: "Das sind alle Packs, die du öffnen kannst. Jede Box hat eigene Karten und eigene Chancen. Für die Tour hab ich noch eine kleine Tutorial-Box reingepackt, die schauen wir uns jetzt genauer an.",
        nextLabel: "Tutorial-Box öffnen",
      },
      en: {
        title: "The packs page",
        body: "These are all the packs you can open. Each box has its own cards and its own odds. I added a little tutorial box just for the tour, let's take a closer look at it.",
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
        body: "Hier klickst du, um ein Pack zu kaufen und direkt zu öffnen. Den Preis siehst du rechts auf dem Button, bei diesem Pack sind das 10 Coins. Keine Sorge, abgebucht wird erst wenn du im Dialog danach bestätigst.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Open a pack",
        body: "Click here to buy a pack and open it right away. You see the price on the right of the button, this one costs 10 coins. Don't worry, nothing gets charged until you confirm in the next dialog.",
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
        body: "Zeigt dir, in welchen Zuständen die Karten aus dieser Box kommen. Mint ist wie neu, Near Mint fast wie neu, dann geht's über Lightly, Moderately bis Heavily Played. Je besser der Zustand, desto mehr Coins kriegst du beim Umwandeln.",
        nextLabel: "Verstanden",
      },
      en: {
        title: "Card condition",
        body: "Shows you what condition the cards in this box come in. Mint is pristine, Near Mint is almost pristine, then you've got Lightly, Moderately and Heavily Played. The better the condition, the more coins you get when you convert.",
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
        body: "Jede Rarität hat ihre eigene Chance in dieser Box. Je seltener die Karte, desto kürzer der Balken und desto wertvoller der Pull. Die Namen unterscheiden sich ein bisschen von Kartenspiel zu Kartenspiel.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Rarity distribution",
        body: "Each rarity has its own chance in this box. The rarer the card, the shorter the bar and the more valuable the pull. The names differ a bit from one TCG to another.",
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
        body: "Die drei wertvollsten Karten dieser Box. Auf die hofft quasi jeder, der das Pack öffnet. An den kleinen Icons siehst du, ob du sie schon gezogen hast.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Top hits",
        body: "The three most valuable cards in this box. Pretty much everyone opening this pack is hoping for these. The little icons show you if you already pulled them.",
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
        body: "Hier siehst du live, was andere gerade aus dieser Box ziehen. Gibt dir ein ganz gutes Gefühl dafür, wie oft die richtig guten Karten wirklich rauskommen. Macht ein bisschen süchtig, warne ich dich.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Live pulls",
        body: "Here you see live what other people are pulling from this box. Gives you a good sense of how often the really good cards actually show up. Fair warning, this is a bit addictive to watch.",
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
        body: "Deine eigene Pull-Historie für diese Box. So behältst du den Überblick, was du schon hast und was dir noch fehlt.",
        nextLabel: "Weiter",
      },
      en: {
        title: "My recent pulls",
        body: "Your own pull history for this box. Helps you see what you already have and what's still missing.",
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
        body: "Unter jeder Karte steht ihre ganz eigene Ziehchance. Grün heißt häufig, gelb eher selten, rot ziemlich selten. Wenn du auf eine Karte klickst, siehst du Marktpreis und Coin-Wert.",
        nextLabel: "Weiter zum Coin-Shop",
      },
      en: {
        title: "Per-card pull chance",
        body: "Each card has its own pull chance right underneath. Green means common, yellow is uncommon, red is rare. Click a card to see market price and coin value.",
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
        title: "Coin-Shop",
        body: "Hier lädst du mit Echtgeld Coins nach, wenn welche fehlen. Das war's auch schon! Ich schreib dir gleich 10 Coins gut als kleines Dankeschön. Viel Spaß beim Sammeln. Wenn du mich brauchst, bin ich unten links bei Packi.",
        nextLabel: "Belohnung abholen",
      },
      en: {
        title: "Coin shop",
        body: "Refill coins here with real money whenever you need more. That's all! I'll credit you 10 coins as a little thank-you. Have fun collecting. If you need me, I'm at Packi, bottom left.",
        nextLabel: "Claim reward",
      },
    },
    copyOnReplay: {
      de: {
        title: "Coin-Shop",
        body: "Hier lädst du mit Echtgeld Coins nach, wenn welche fehlen. Das war die Tour. Viel Spaß beim Sammeln. Wenn du mich brauchst, bin ich unten links bei Packi.",
        nextLabel: "Fertig",
      },
      en: {
        title: "Coin shop",
        body: "Refill coins here with real money whenever you need more. That was the tour. Have fun collecting. If you need me, I'm at Packi, bottom left.",
        nextLabel: "Done",
      },
    },
  },
];
