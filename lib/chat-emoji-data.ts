import emojisDe from "emoji-picker-react/dist/data/emojis-de.json";
import emojisEn from "emoji-picker-react/dist/data/emojis-en.json";

type EmojiPickerData = typeof emojisDe;
type EmojiEntry = {
  n?: string[];
  u: string;
  v?: string[];
  a: string;
};

const EXTRA_SEARCH_ALIASES: ReadonlyArray<{
  aliases: readonly string[];
  pattern: RegExp;
}> = [
  {
    aliases: ["laugh", "laughing", "haha", "lol", "lachen", "lachend", "smile"],
    pattern:
      /\b(laugh|laughing|lachen|lach|rofl|rotfl|joy|freudentr(?:ä|ae)nen|lol|haha|grin|grinning|grins|grinsend|smile|smiling|lächel|laechel|lustig|happy|beaming|satisfied)\b/i,
  },
  {
    aliases: ["fire", "flame", "burning", "feuer", "flamme"],
    pattern:
      /\b(fire|feuer|flame|flamme|burn|burning|brenn|phoenix|firework|fireworks|firecracker|sparkler|funken)\b/i,
  },
];

const CHAT_EMOJI_DATA = {
  de: mergeEmojiData(emojisDe, emojisEn),
  en: mergeEmojiData(emojisEn, emojisDe),
} as const;
const CHAT_EMOJI_VALUES = buildChatEmojiValues([emojisDe, emojisEn]);

export function getChatEmojiData(lang?: string) {
  return lang === "de" ? CHAT_EMOJI_DATA.de : CHAT_EMOJI_DATA.en;
}

export function isKnownChatEmojiValue(value: string) {
  return CHAT_EMOJI_VALUES.has(value);
}

function mergeEmojiData(primary: EmojiPickerData, secondary: EmojiPickerData): EmojiPickerData {
  const secondaryByUnified = buildEmojiLookup(secondary);

  return {
    ...primary,
    emojis: Object.fromEntries(
      Object.entries(primary.emojis).map(([category, entries]) => [
        category,
        entries.map((entry) => {
          const secondaryEntry = secondaryByUnified.get(entry.u);
          const mergedNames = expandSearchNames([...(entry.n ?? []), ...(secondaryEntry?.n ?? [])]);

          return {
            ...entry,
            n: mergedNames,
          };
        }),
      ])
    ) as EmojiPickerData["emojis"],
  };
}

function buildEmojiLookup(data: EmojiPickerData) {
  const lookup = new Map<string, EmojiEntry>();

  for (const entries of Object.values(data.emojis)) {
    for (const entry of entries) {
      if (!lookup.has(entry.u)) {
        lookup.set(entry.u, entry);
      }
    }
  }

  return lookup;
}

function expandSearchNames(names: string[]) {
  const uniqueNames = new Set(
    names.map((name) => normalizeSearchName(name)).filter(Boolean)
  );
  const combined = Array.from(uniqueNames).join(" ");

  for (const rule of EXTRA_SEARCH_ALIASES) {
    if (!rule.pattern.test(combined)) {
      continue;
    }

    for (const alias of rule.aliases) {
      uniqueNames.add(alias);
    }
  }

  return Array.from(uniqueNames);
}

function normalizeSearchName(name: string) {
  return name.trim().toLowerCase();
}

function buildChatEmojiValues(datasets: EmojiPickerData[]) {
  const values = new Set<string>();

  for (const dataset of datasets) {
    for (const entries of Object.values(dataset.emojis)) {
      for (const entry of entries) {
        values.add(unifiedToEmoji(entry.u));

        const variations =
          "v" in entry && Array.isArray(entry.v) ? entry.v : [];

        for (const variation of variations) {
          values.add(unifiedToEmoji(variation));
        }
      }
    }
  }

  return values;
}

function unifiedToEmoji(unified: string) {
  return String.fromCodePoint(
    ...unified.split("-").map((part) => Number.parseInt(part, 16))
  );
}
