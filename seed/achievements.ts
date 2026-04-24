import Achievement from "@/models/achievement";
import Translation from "@/models/translation";
import { upsertAchievementTranslations } from "@/lib/admin/achievement-payload";

interface SeedAchievement {
  key: string;
  category: "level" | "progression" | "battle" | "economy" | "social" | "event";
  hidden?: boolean;
  sortOrder: number;
  trigger:
    | { type: "level"; params: { level: number } }
    | { type: "counter"; params: { metric: string; target: number } }
    | { type: "once"; params: { event: string } }
    | { type: "manual"; params: Record<string, never> };
  rewards: Array<{
    type: "coins" | "convert_multiplier" | "unlock_box" | "cosmetic" | "grant_badge";
    params: Record<string, unknown>;
  }>;
  titles: { de: string; en: string };
  descriptions: { de: string; en: string };
}

/**
 * Seed-Achievements für PACKATTACK. Der Seed ist idempotent über den
 * unique-key — wiederholtes Ausführen legt nichts doppelt an, aktualisiert
 * aber Texte und Rewards. Copy ist absichtlich menschlich gehalten, ohne
 * Bindestriche vom Typ "em dash".
 */
export const SEED_ACHIEVEMENTS: SeedAchievement[] = [
  // Level-Milestones
  {
    key: "level_5",
    category: "level",
    sortOrder: 10,
    trigger: { type: "level", params: { level: 5 } },
    rewards: [{ type: "coins", params: { amount: 100 } }],
    titles: { de: "Warmgelaufen", en: "Warmed up" },
    descriptions: {
      de: "Du hast Level 5 erreicht. 100 Bonus-Coins warten auf dich.",
      en: "You reached level 5. 100 bonus coins are yours.",
    },
  },
  {
    key: "level_10",
    category: "level",
    sortOrder: 20,
    trigger: { type: "level", params: { level: 10 } },
    rewards: [
      { type: "coins", params: { amount: 300 } },
      { type: "convert_multiplier", params: { multiplier: 1.05 } },
    ],
    titles: { de: "Stammspieler", en: "Regular" },
    descriptions: {
      de: "Level 10 geschafft. Dauerbonus von 5 Prozent auf Karten-Convert plus 300 Coins.",
      en: "Level 10 reached. Permanent 5 percent bonus on card convert plus 300 coins.",
    },
  },
  {
    key: "level_25",
    category: "level",
    sortOrder: 30,
    trigger: { type: "level", params: { level: 25 } },
    rewards: [
      { type: "coins", params: { amount: 1000 } },
      { type: "convert_multiplier", params: { multiplier: 1.1 } },
    ],
    titles: { de: "Profi", en: "Pro" },
    descriptions: {
      de: "Level 25. Du kennst PACKATTACK auswendig. Convert-Bonus auf 10 Prozent hochgestuft.",
      en: "Level 25. You know PACKATTACK inside out. Convert bonus bumps to 10 percent.",
    },
  },
  {
    key: "level_50",
    category: "level",
    sortOrder: 40,
    trigger: { type: "level", params: { level: 50 } },
    rewards: [
      { type: "coins", params: { amount: 5000 } },
      { type: "cosmetic", params: { slot: "title", value: "PACKATTACK Veteran" } },
    ],
    titles: { de: "Veteran", en: "Veteran" },
    descriptions: {
      de: "Level 50. 5000 Coins und der Titel PACKATTACK Veteran als Anerkennung.",
      en: "Level 50. 5000 coins and the title PACKATTACK Veteran as recognition.",
    },
  },
  {
    key: "level_100",
    category: "level",
    sortOrder: 50,
    trigger: { type: "level", params: { level: 100 } },
    rewards: [
      { type: "coins", params: { amount: 25000 } },
      { type: "cosmetic", params: { slot: "title", value: "PACKATTACK Legende" } },
      { type: "convert_multiplier", params: { multiplier: 1.15 } },
    ],
    titles: { de: "Legende", en: "Legend" },
    descriptions: {
      de: "Level 100. Maximal erreicht. 25000 Coins, Legenden-Titel und 15 Prozent dauerhafter Convert-Bonus.",
      en: "Level 100 maxed out. 25000 coins, Legend title and a permanent 15 percent convert bonus.",
    },
  },

  // Progression-Counters
  {
    key: "open_first_pack",
    category: "progression",
    sortOrder: 100,
    trigger: { type: "once", params: { event: "first_pack_opened" } },
    rewards: [{ type: "coins", params: { amount: 50 } }],
    titles: { de: "Erste Öffnung", en: "First open" },
    descriptions: {
      de: "Deine erste Box. Willkommen bei PACKATTACK.",
      en: "Your first box. Welcome to PACKATTACK.",
    },
  },
  {
    key: "open_10_boxes",
    category: "progression",
    sortOrder: 110,
    trigger: { type: "counter", params: { metric: "boxesOpened", target: 10 } },
    rewards: [{ type: "coins", params: { amount: 150 } }],
    titles: { de: "Sammler", en: "Collector" },
    descriptions: {
      de: "Zehn Boxen geöffnet. Da entsteht eine Sammlung.",
      en: "Ten boxes opened. A collection is forming.",
    },
  },
  {
    key: "open_100_boxes",
    category: "progression",
    sortOrder: 120,
    trigger: { type: "counter", params: { metric: "boxesOpened", target: 100 } },
    rewards: [
      { type: "coins", params: { amount: 1000 } },
      { type: "convert_multiplier", params: { multiplier: 1.05 } },
    ],
    titles: { de: "Fleißiger Öffner", en: "Diligent opener" },
    descriptions: {
      de: "Hundert Boxen. Dein Handgelenk hat es verdient.",
      en: "One hundred boxes. Your wrist earned it.",
    },
  },
  {
    key: "open_1000_boxes",
    category: "progression",
    sortOrder: 130,
    trigger: { type: "counter", params: { metric: "boxesOpened", target: 1000 } },
    rewards: [{ type: "coins", params: { amount: 10000 } }],
    titles: { de: "Box-Maschine", en: "Box machine" },
    descriptions: {
      de: "Tausend Boxen. Wir sind beeindruckt.",
      en: "A thousand boxes. We are impressed.",
    },
  },
  {
    key: "convert_100_cards",
    category: "economy",
    sortOrder: 200,
    trigger: { type: "counter", params: { metric: "cardsConverted", target: 100 } },
    rewards: [{ type: "coins", params: { amount: 500 } }],
    titles: { de: "Recycler", en: "Recycler" },
    descriptions: {
      de: "Hundert Karten zurück in Coins gewandelt. Vernünftig.",
      en: "Turned one hundred cards back into coins. Sensible.",
    },
  },

  // Battle
  {
    key: "first_battle_played",
    category: "battle",
    sortOrder: 300,
    trigger: { type: "once", params: { event: "first_battle" } },
    rewards: [{ type: "coins", params: { amount: 75 } }],
    titles: { de: "Erster Battle", en: "First battle" },
    descriptions: {
      de: "Dein erstes Battle liegt hinter dir, egal wie es ausging.",
      en: "Your first battle is in the books, win or lose.",
    },
  },
  {
    key: "win_10_battles",
    category: "battle",
    sortOrder: 310,
    trigger: { type: "counter", params: { metric: "battlesWon", target: 10 } },
    rewards: [{ type: "coins", params: { amount: 500 } }],
    titles: { de: "Siegesserie", en: "On a roll" },
    descriptions: {
      de: "Zehn Siege gesammelt. Die anderen fürchten dich schon.",
      en: "Ten wins on the board. The others are taking notes.",
    },
  },
  {
    key: "win_100_battles",
    category: "battle",
    sortOrder: 320,
    trigger: { type: "counter", params: { metric: "battlesWon", target: 100 } },
    rewards: [
      { type: "coins", params: { amount: 5000 } },
      { type: "cosmetic", params: { slot: "title", value: "Battle-Champion" } },
    ],
    titles: { de: "Battle-Champion", en: "Battle champion" },
    descriptions: {
      de: "Hundert Siege. Der Titel Battle-Champion gehört dir.",
      en: "One hundred wins. The title Battle Champion is yours.",
    },
  },

  // Login-Streak
  {
    key: "login_streak_7",
    category: "event",
    sortOrder: 400,
    trigger: { type: "counter", params: { metric: "loginDays", target: 7 } },
    rewards: [{ type: "coins", params: { amount: 200 } }],
    titles: { de: "Treue Seele", en: "Loyal soul" },
    descriptions: {
      de: "Sieben Tage am Stück dabei. 200 Coins zum Dank.",
      en: "Seven days in a row. 200 coins as a thank you.",
    },
  },
  {
    key: "login_streak_30",
    category: "event",
    sortOrder: 410,
    trigger: { type: "counter", params: { metric: "loginDays", target: 30 } },
    rewards: [
      { type: "coins", params: { amount: 1500 } },
      { type: "cosmetic", params: { slot: "frame", value: "streak-30" } },
    ],
    titles: { de: "Stammkunde", en: "Regular" },
    descriptions: {
      de: "Dreißig Tage dabei. Ein exklusiver Avatar-Rahmen und Coins als Dank.",
      en: "Thirty days strong. An exclusive avatar frame and coins as thanks.",
    },
  },

  // Tour
  {
    key: "tour_completed",
    category: "event",
    sortOrder: 500,
    trigger: { type: "once", params: { event: "tour_completed" } },
    rewards: [{ type: "coins", params: { amount: 100 } }],
    titles: { de: "Willkommens-Tour", en: "Welcome tour" },
    descriptions: {
      de: "Tour abgeschlossen. Jetzt kennst du die wichtigsten Ecken.",
      en: "Tour completed. You know all the corners now.",
    },
  },
];

export async function seedAchievements(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const seed of SEED_ACHIEVEMENTS) {
    const existing = await Achievement.findOne({ key: seed.key });
    if (!existing) {
      await Achievement.create({
        key: seed.key,
        titleKey: `achievements.${seed.key}.title`,
        descriptionKey: `achievements.${seed.key}.description`,
        iconImageId: null,
        category: seed.category,
        hidden: seed.hidden ?? false,
        active: true,
        sortOrder: seed.sortOrder,
        trigger: seed.trigger,
        rewards: seed.rewards,
      });
      created++;
    } else {
      // Preserve iconImageId (Admin-Upload), aktualisiere Rewards/Config falls
      // Seed sich geändert hat, ohne active=false zu übersteuern.
      existing.set({
        category: seed.category,
        hidden: seed.hidden ?? false,
        sortOrder: seed.sortOrder,
        trigger: seed.trigger,
        rewards: seed.rewards,
      });
      existing.markModified("trigger");
      existing.markModified("rewards");
      await existing.save();
      updated++;
    }
    await upsertAchievementTranslations(
      Translation,
      seed.key,
      seed.titles,
      seed.descriptions,
      null,
    );
  }

  return { created, updated };
}
