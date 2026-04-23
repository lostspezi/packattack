import type { TourStep } from "@/lib/tour/step-types";

/**
 * Onboarding tour (replaces the earlier narrative-only social tour).
 *
 * Flow: welcome → spot tutorial box on /packs → buy tutorial box →
 * reveal (waits for "pack-opened" event) → explain sell-vs-cart →
 * cart reservation window → balance top-up → reward.
 *
 * Interactive: steps 2-4 drive a real purchase + pack open using the
 * user's signup-starter coins (which are sized to exactly match the
 * tutorial box price).
 * Visual-only: cart and balance are narrated; the user can proceed via
 * "Weiter" without triggering real checkouts. Skipping the tour at any
 * point is non-destructive.
 *
 * Placeholders: `{lang}` and `{tutorialSlug}` — the TourProvider fetches
 * /api/tutorial-box at tour-start and injects the slug.
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
        title: "Hey, ich bin Packi ✨",
        body: "Ich zeig dir in 7 kurzen Schritten, wie PACKATTACK funktioniert. Du kannst jederzeit abbrechen — am Ende gibt's 10 Coins als Belohnung.",
        nextLabel: "Los geht's",
      },
      en: {
        title: "Hey, I'm Packi ✨",
        body: "I'll walk you through PACKATTACK in 7 quick steps. You can bail anytime — finish it to grab 10 bonus coins.",
        nextLabel: "Let's go",
      },
    },
  },
  {
    id: "pack-discover",
    route: "/{lang}/packs",
    selector: '[data-tour-tutorial-box="true"]',
    placement: "right",
    nextTrigger: { type: "click-target" },
    waitTimeoutMs: 4000,
    targetOptional: true,
    copy: {
      de: {
        title: "Deine Tutorial-Box",
        body: "Diese Box kostet genau deine 10 Start-Coins. Klick drauf, um sie dir anzuschauen.",
        nextLabel: "Box öffnen",
      },
      en: {
        title: "Your tutorial box",
        body: "This one costs exactly your 10 starter coins. Click it to take a look.",
        nextLabel: "Open box",
      },
    },
  },
  {
    id: "pack-buy",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="pack-buy-button"]',
    placement: "top",
    nextTrigger: { type: "click-target" },
    waitTimeoutMs: 5000,
    targetOptional: true,
    copy: {
      de: {
        title: "Pack kaufen",
        body: "Klick hier, um das Pack für 10 Coins zu kaufen und direkt zu öffnen.",
        nextLabel: "Kaufen",
      },
      en: {
        title: "Buy the pack",
        body: "Click here to buy this pack for 10 coins and open it immediately.",
        nextLabel: "Buy",
      },
    },
  },
  {
    id: "pack-opening",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="pack-reveal"]',
    placement: "bottom",
    nextTrigger: { type: "event", event: "pack-opened" },
    waitTimeoutMs: 20000,
    targetOptional: true,
    copy: {
      de: {
        title: "Pack wird geöffnet…",
        body: "Schau gut hin — deine Karten erscheinen gleich. Bei seltenen Karten gibt's eine Reveal-Animation.",
        nextLabel: "Weiter",
      },
      en: {
        title: "Opening the pack…",
        body: "Keep an eye on the reveal — rare cards get their own animation.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "card-decision",
    route: "/{lang}/packs/{tutorialSlug}",
    selector: '[data-tour="card-decision"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Umwandeln oder behalten?",
        body: "Pro Karte entscheidest du: entweder sofort in Coins umwandeln, oder in den Warenkorb legen und dir später physisch schicken lassen. Beide Optionen stehen jetzt bereit.",
        nextLabel: "Verstanden",
      },
      en: {
        title: "Convert or keep?",
        body: "For each card you choose: convert to coins right away, or drop into the cart to have it shipped later. Both options are there now.",
        nextLabel: "Got it",
      },
    },
  },
  {
    id: "cart-reservation",
    route: "/{lang}/cart",
    selector: '[data-tour="cart-items"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "3-Stunden-Fenster",
        body: "Karten im Warenkorb sind für 3 Stunden reserviert. Danach gehen sie automatisch zurück in den Pool und du kriegst den Coin-Gegenwert.",
        nextLabel: "Weiter",
      },
      en: {
        title: "3-hour reservation",
        body: "Cards in your cart are held for 3 hours. After that they go back to the pool and you're credited the coin value.",
        nextLabel: "Next",
      },
    },
  },
  {
    id: "balance-topup",
    route: "/{lang}/balance",
    selector: '[data-tour="balance-topup"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Coins nachladen",
        body: "Leer? Hier lädst du Coins mit Echtgeld nach — sichere Zahlung über Stripe. Tests werden nicht belastet.",
        nextLabel: "Alles klar",
      },
      en: {
        title: "Top up coins",
        body: "Running low? Here you refill coins with real money — Stripe handles the payment. Test runs aren't charged.",
        nextLabel: "Got it",
      },
    },
  },
  {
    id: "tour-reward",
    route: "/{lang}/balance",
    selector: '[data-tour="balance-topup"]',
    placement: "top",
    nextTrigger: { type: "click-next" },
    targetOptional: true,
    copy: {
      de: {
        title: "Tour beendet 🎴",
        body: "Du hast es geschafft! 10 Coins als Dankeschön landen jetzt auf deinem Konto. Viel Spaß beim Sammeln — du findest mich unten links, wenn du mich brauchst.",
        nextLabel: "Belohnung abholen",
      },
      en: {
        title: "Tour complete 🎴",
        body: "You did it! 10 coins are landing in your wallet as a thank-you. Happy collecting — I'm bottom-left whenever you need me.",
        nextLabel: "Claim reward",
      },
    },
  },
];
