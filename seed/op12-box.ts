/**
 * Seed data for the One Piece OP12 "Legacy of the Master" box.
 * Card data sourced from JustTCG API (2026-04-02).
 *
 * Weights derived from real-world OPTCG pull rate data (community-verified,
 * Bandai does not publish official rates). Normalized to Common = 100.
 *
 * Per box (24 packs, 288 card pulls):
 *   Common  ~150 pulls / 44 cards → 3.41/card → weight 100
 *   Uncommon ~60 pulls / 30 cards → 2.00/card → weight 59
 *   DON!!    ~24 pulls (own slot)  / 3 cards  → weight 40
 *   Leader   ~5 pulls  / 6 cards  → 0.83/card → weight 24
 *   Rare     ~24 pulls / 26 cards → 0.92/card → weight 27
 *   Super Rare ~9 pulls / 10 cards → 0.90/card → weight 26
 *   Secret Rare ~1 pull / 2 cards → 0.50/card → weight 15
 *   Alt Art  ~2 pulls  / ~28 cards → 0.07/card → weight 2
 *   Treasure Rare ~0.3 pulls / 1 card         → weight 3
 *   SP       ~0.1 pulls / 8 cards → 0.013/card → weight 0.4
 *   Manga Rare ~1 per 288 packs / 1 card      → weight 0.15
 *
 * Within each tier, all cards share equal weight (real pull rates
 * are uniform per rarity — price differences reflect demand, not odds).
 *
 * Sources:
 *   https://one-piece-tcg.com/guides/card-rarity-guide
 *   https://cardcosmos.de/en/blogs/news/one-piece-card-game-pull-rates-hitrates-der-japanischen-edition
 *   https://cardgamer.com/games/one-piece-card-game-rarities/
 */

export interface OP12CardSeed {
  justTcgId: string;
  name: string;
  number: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  tcgplayerId: string | null;
  marketPrice: number;
  weight: number;
}

const GAME = "one-piece-card-game";
const SET = "legacy-of-the-master-one-piece-card-game";
const SET_NAME = "Legacy of the Master";

export const op12BoxConfig = {
  name: { de: "OP12 - Legacy of the Master", en: "OP12 - Legacy of the Master" },
  description: {
    de: "Das neueste One Piece Set OP12 mit 158 Karten - von Commons bis zu ultra-seltenen SP- und Secret Rare Karten!",
    en: "The latest One Piece set OP12 featuring 158 cards - from commons to ultra-rare SP and Secret Rare cards!",
  },
  game: GAME,
  priceInCoins: 150,
  cardsPerPack: 5,
  totalPacks: null,
  coinConversionRate: 50,
  battleFeePerRound: 25,
  status: "published" as const,
};

export const op12Cards: OP12CardSeed[] = [
  // ── SP Cards (~0.1 per box across 8 SP cards → 0.013/card → weight 0.4) ─
  { justTcgId: "one-piece-card-game-legacy-of-the-master-marshall-d-teach-sp-gold-super-rare", name: "Marshall.D.Teach (SP) (Gold)", number: "OP09-093", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646573", marketPrice: 1181.05, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-marshall-d-teach-sp-silver-super-rare", name: "Marshall.D.Teach (SP) (Silver)", number: "OP09-093", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646572", marketPrice: 745.24, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-zoro-juurou-sp-super-rare", name: "Zoro-Juurou (SP)", number: "ST18-004", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646566", marketPrice: 198.85, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-portgas-d-ace-sp-super-rare", name: "Portgas.D.Ace (SP)", number: "ST13-011", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646571", marketPrice: 154.69, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-tashigi-sp-rare", name: "Tashigi (SP)", number: "OP06-050", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "646565", marketPrice: 76.58, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuzan-sp-super-rare", name: "Kuzan (SP)", number: "OP10-082", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646567", marketPrice: 75.47, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-yasopp-sp-rare", name: "Yasopp (SP)", number: "OP09-013", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "646563", marketPrice: 43.50, weight: 0.4 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-lim-sp-super-rare", name: "Lim (SP)", number: "OP09-037", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "646564", marketPrice: 43.13, weight: 0.4 },

  // ── Manga Secret Rare (~1 per 288 packs) ──────────────────────────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jewelry-bonney-118-manga-secret-rare", name: "Jewelry Bonney (118) (Manga)", number: "OP12-118", game: GAME, set: SET, setName: SET_NAME, rarity: "Secret Rare", tcgplayerId: "643867", marketPrice: 941.40, weight: 0.15 },

  // ── Treasure Rare (~0.3 per box, 1 card) ──────────────────────────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-vinsmoke-sanji-tr-treasure-rare", name: "Vinsmoke Sanji (TR)", number: "OP10-063", game: GAME, set: SET, setName: SET_NAME, rarity: "Treasure Rare", tcgplayerId: "644882", marketPrice: 32.46, weight: 3 },

  // ── Secret Rares (~1 per box ÷ 2 base cards = 0.5/card → weight 15) ──
  { justTcgId: "one-piece-card-game-legacy-of-the-master-bartholomew-kuma-secret-rare", name: "Bartholomew Kuma", number: "OP12-119", game: GAME, set: SET, setName: SET_NAME, rarity: "Secret Rare", tcgplayerId: "643868", marketPrice: 34.40, weight: 15 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jewelry-bonney-118-secret-rare", name: "Jewelry Bonney (118)", number: "OP12-118", game: GAME, set: SET, setName: SET_NAME, rarity: "Secret Rare", tcgplayerId: "643865", marketPrice: 10.27, weight: 15 },

  // ── Alt Art Secret Rares (~2 AA pulls/box ÷ ~28 AA cards → weight 2) ──
  { justTcgId: "one-piece-card-game-legacy-of-the-master-bartholomew-kuma-alternate-art-secret-rare", name: "Bartholomew Kuma (Alternate Art)", number: "OP12-119", game: GAME, set: SET, setName: SET_NAME, rarity: "Secret Rare", tcgplayerId: "643869", marketPrice: 59.83, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jewelry-bonney-118-alternate-art-secret-rare", name: "Jewelry Bonney (118) (Alternate Art)", number: "OP12-118", game: GAME, set: SET, setName: SET_NAME, rarity: "Secret Rare", tcgplayerId: "643866", marketPrice: 21.46, weight: 2 },

  // ── Alt Art Rares (~2 AA pulls/box ÷ ~28 AA cards → 0.07/card → weight 2)
  { justTcgId: "one-piece-card-game-legacy-of-the-master-demon-aura-nine-sword-style-asura-blades-drawn-dead-man-s-game-alternate-art-rare", name: "Demon Aura Nine Sword Style Asura Blades Drawn Dead Man's Game (Alternate Art)", number: "OP12-037", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643769", marketPrice: 136.28, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-boeuf-burst-alternate-art-rare", name: "Boeuf Burst (Alternate Art)", number: "OP12-060", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643797", marketPrice: 72.33, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-tashigi-alternate-art-rare", name: "Tashigi (Alternate Art)", number: "OP12-031", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643761", marketPrice: 17.29, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuzan-043-alternate-art-rare", name: "Kuzan (043) (Alternate Art)", number: "OP12-043", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643778", marketPrice: 14.22, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sanji-070-alternate-art-rare", name: "Sanji (070) (Alternate Art)", number: "OP12-070", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643810", marketPrice: 13.20, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-koala-086-alternate-art-rare", name: "Koala (086) (Alternate Art)", number: "OP12-086", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643829", marketPrice: 9.28, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shanks-008-alternate-art-rare", name: "Shanks (008) (Alternate Art)", number: "OP12-008", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643733", marketPrice: 6.67, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-rosinante-108-alternate-art-rare", name: "Donquixote Rosinante (108) (Alternate Art)", number: "OP12-108", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643855", marketPrice: 5.86, weight: 2 },

  // ── Alt Art Leaders (~2 AA pulls/box ÷ ~28 AA cards → weight 2) ───────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-roronoa-zoro-020-alternate-art-leader", name: "Roronoa Zoro (020) (Alternate Art)", number: "OP12-020", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643748", marketPrice: 58.28, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-rosinante-061-alternate-art-leader", name: "Donquixote Rosinante (061) (Alternate Art)", number: "OP12-061", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643799", marketPrice: 41.30, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sanji-041-alternate-art-leader", name: "Sanji (041) (Alternate Art)", number: "OP12-041", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643775", marketPrice: 35.69, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-koala-081-alternate-art-leader", name: "Koala (081) (Alternate Art)", number: "OP12-081", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643823", marketPrice: 21.89, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuzan-040-alternate-art-leader", name: "Kuzan (040) (Alternate Art)", number: "OP12-040", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643773", marketPrice: 21.24, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-silvers-rayleigh-alternate-art-leader", name: "Silvers Rayleigh (Alternate Art)", number: "OP12-001", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643724", marketPrice: 18.42, weight: 2 },

  // ── Alt Art Super Rares (~2 AA pulls/box ÷ ~28 AA cards → weight 2) ───
  { justTcgId: "one-piece-card-game-legacy-of-the-master-perona-alternate-art-super-rare", name: "Perona (Alternate Art)", number: "OP12-034", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643765", marketPrice: 41.44, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-nico-robin-alternate-art-super-rare", name: "Nico Robin (Alternate Art)", number: "OP12-087", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643831", marketPrice: 31.27, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-trafalgar-law-073-alternate-art-super-rare", name: "Trafalgar Law (073) (Alternate Art)", number: "OP12-073", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643814", marketPrice: 15.16, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-boa-hancock-alternate-art-super-rare", name: "Boa Hancock (Alternate Art)", number: "OP12-014", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643740", marketPrice: 14.61, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-vinsmoke-reiju-alternate-art-super-rare", name: "Vinsmoke Reiju (Alternate Art)", number: "OP12-063", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643802", marketPrice: 12.99, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-garp-alternate-art-super-rare", name: "Monkey.D.Garp (Alternate Art)", number: "OP12-056", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643792", marketPrice: 11.68, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-dracule-mihawk-alternate-art-super-rare", name: "Dracule Mihawk (Alternate Art)", number: "OP12-030", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643759", marketPrice: 11.58, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-dragon-alternate-art-super-rare", name: "Monkey.D.Dragon (Alternate Art)", number: "OP12-094", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643839", marketPrice: 11.11, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shirahoshi-alternate-art-super-rare", name: "Shirahoshi (Alternate Art)", number: "OP12-102", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643848", marketPrice: 9.27, weight: 2 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-luffy-alternate-art-super-rare", name: "Monkey.D.Luffy (Alternate Art)", number: "OP12-015", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643742", marketPrice: 7.41, weight: 2 },

  // ── Super Rares (~9 per box ÷ 10 cards = 0.9/card → weight 26) ───────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-perona-super-rare", name: "Perona", number: "OP12-034", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643764", marketPrice: 8.38, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-dracule-mihawk-super-rare", name: "Dracule Mihawk", number: "OP12-030", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643758", marketPrice: 1.45, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-nico-robin-super-rare", name: "Nico Robin", number: "OP12-087", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643830", marketPrice: 1.21, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-luffy-super-rare", name: "Monkey.D.Luffy", number: "OP12-015", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643741", marketPrice: 0.82, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-vinsmoke-reiju-super-rare", name: "Vinsmoke Reiju", number: "OP12-063", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643801", marketPrice: 0.67, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-trafalgar-law-073-super-rare", name: "Trafalgar Law (073)", number: "OP12-073", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643813", marketPrice: 0.64, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-dragon-super-rare", name: "Monkey.D.Dragon", number: "OP12-094", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643838", marketPrice: 0.63, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-boa-hancock-super-rare", name: "Boa Hancock", number: "OP12-014", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643739", marketPrice: 0.54, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shirahoshi-super-rare", name: "Shirahoshi", number: "OP12-102", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643847", marketPrice: 0.52, weight: 26 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monkey-d-garp-super-rare", name: "Monkey.D.Garp", number: "OP12-056", game: GAME, set: SET, setName: SET_NAME, rarity: "Super Rare", tcgplayerId: "643791", marketPrice: 0.33, weight: 26 },

  // ── DON!! Cards (own slot in real packs, ~uncommon frequency) ─────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-don-card-2y-double-pack-set-vol-8-don", name: "DON!! Card (2Y) (Double Pack Set Vol. 8)", number: "N/A", game: GAME, set: SET, setName: SET_NAME, rarity: "DON!!", tcgplayerId: "651174", marketPrice: 1.96, weight: 40 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-don-card-3d-double-pack-set-vol-8-don", name: "DON!! Card (3D) (Double Pack Set Vol. 8)", number: "N/A", game: GAME, set: SET, setName: SET_NAME, rarity: "DON!!", tcgplayerId: "651175", marketPrice: 1.30, weight: 40 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-don-card-alternate-art-don", name: "DON!! Card (Alternate Art)", number: "N/A", game: GAME, set: SET, setName: SET_NAME, rarity: "DON!!", tcgplayerId: "646574", marketPrice: 0.26, weight: 40 },

  // ── Leaders (~5 per box ÷ 6 cards = 0.83/card → weight 24) ───────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-roronoa-zoro-020-leader", name: "Roronoa Zoro (020)", number: "OP12-020", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643747", marketPrice: 0.14, weight: 24 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sanji-041-leader", name: "Sanji (041)", number: "OP12-041", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643774", marketPrice: 0.14, weight: 24 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-silvers-rayleigh-leader", name: "Silvers Rayleigh", number: "OP12-001", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643723", marketPrice: 0.13, weight: 24 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-koala-081-leader", name: "Koala (081)", number: "OP12-081", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643822", marketPrice: 0.12, weight: 24 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-rosinante-061-leader", name: "Donquixote Rosinante (061)", number: "OP12-061", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643798", marketPrice: 0.09, weight: 24 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuzan-040-leader", name: "Kuzan (040)", number: "OP12-040", game: GAME, set: SET, setName: SET_NAME, rarity: "Leader", tcgplayerId: "643772", marketPrice: 0.08, weight: 24 },

  // ── Rares (~24 per box ÷ 26 cards = 0.92/card → weight 27) ───────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-demon-aura-nine-sword-style-asura-blades-drawn-dead-man-s-game-rare", name: "Demon Aura Nine Sword Style Asura Blades Drawn Dead Man's Game", number: "OP12-037", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643768", marketPrice: 3.42, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-charlotte-pudding-rare", name: "Charlotte Pudding", number: "OP12-071", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643811", marketPrice: 1.82, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-baby-5-112-rare", name: "Baby 5 (112)", number: "OP12-112", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643859", marketPrice: 0.32, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-boeuf-burst-rare", name: "Boeuf Burst", number: "OP12-060", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643796", marketPrice: 0.26, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-luffy-is-the-man-who-will-become-the-king-of-pirates-rare", name: "Luffy Is the Man Who Will Become the King of Pirates!!!", number: "OP12-039", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643771", marketPrice: 0.23, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-luffy-is-the-man-who-will-be-king-of-the-pirates-rare", name: "Luffy Is the Man Who Will Be King of the Pirates!!!", number: "OP12-079", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643820", marketPrice: 0.22, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shanks-008-rare", name: "Shanks (008)", number: "OP12-008", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643732", marketPrice: 0.21, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-koala-086-rare", name: "Koala (086)", number: "OP12-086", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643828", marketPrice: 0.20, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kouzuki-hiyori-rare", name: "Kouzuki Hiyori", number: "OP12-028", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643756", marketPrice: 0.18, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sakazuki-rare", name: "Sakazuki", number: "OP12-044", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643779", marketPrice: 0.17, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-color-of-the-supreme-king-haki-rare", name: "Color of the Supreme King Haki", number: "OP12-018", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643745", marketPrice: 0.17, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-tashigi-rare", name: "Tashigi", number: "OP12-031", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643760", marketPrice: 0.16, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-borsalino-rare", name: "Borsalino", number: "OP12-053", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643788", marketPrice: 0.16, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sanji-070-rare", name: "Sanji (070)", number: "OP12-070", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643809", marketPrice: 0.16, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-rosinante-108-rare", name: "Donquixote Rosinante (108)", number: "OP12-108", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643854", marketPrice: 0.14, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sabo-rare", name: "Sabo", number: "OP12-100", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643845", marketPrice: 0.14, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuzan-043-rare", name: "Kuzan (043)", number: "OP12-043", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643777", marketPrice: 0.13, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-hack-rare", name: "Hack", number: "OP12-089", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643833", marketPrice: 0.13, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-vinsmoke-sora-rare", name: "Vinsmoke Sora", number: "OP12-062", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643800", marketPrice: 0.13, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sengoku-rare", name: "Sengoku", number: "OP12-047", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643782", marketPrice: 0.12, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kalgara-rare", name: "Kalgara", number: "OP12-099", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643844", marketPrice: 0.12, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-captains-assembled-rare", name: "Captains Assembled", number: "OP12-097", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643842", marketPrice: 0.11, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jinbe-rare", name: "Jinbe", number: "OP12-009", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643734", marketPrice: 0.11, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-doflamingo-rare", name: "Donquixote Doflamingo", number: "OP12-107", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643853", marketPrice: 0.11, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-slam-gibson-rare", name: "Slam Gibson", number: "OP12-117", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643864", marketPrice: 0.09, weight: 27 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shakuyaku-rare", name: "Shakuyaku", number: "OP12-006", game: GAME, set: SET, setName: SET_NAME, rarity: "Rare", tcgplayerId: "643730", marketPrice: 0.09, weight: 27 },

  // ── Uncommons (~60 per box ÷ 30 cards = 2.0/card → weight 59) ────────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-koushirou-uncommon", name: "Koushirou", number: "OP12-027", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643755", marketPrice: 0.21, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kuina-uncommon", name: "Kuina", number: "OP12-026", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643754", marketPrice: 0.20, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-hina-uncommon", name: "Hina", number: "OP12-051", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643786", marketPrice: 0.17, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-i-love-you-uncommon", name: "I Love You!!", number: "OP12-115", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643862", marketPrice: 0.15, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-monet-uncommon", name: "Monet", number: "OP12-076", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643817", marketPrice: 0.15, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-roronoa-zoro-113-uncommon", name: "Roronoa Zoro (113)", number: "OP12-113", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643860", marketPrice: 0.13, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-hair-removal-fist-uncommon", name: "Hair Removal Fist", number: "OP12-098", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643843", marketPrice: 0.12, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shimotsuki-kouzaburou-uncommon", name: "Shimotsuki Kouzaburou", number: "OP12-029", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643757", marketPrice: 0.12, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-buggy-049-uncommon", name: "Buggy (049)", number: "OP12-049", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643784", marketPrice: 0.12, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-morley-uncommon", name: "Morley", number: "OP12-093", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643837", marketPrice: 0.12, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-trafalgar-law-106-uncommon", name: "Trafalgar Law (106)", number: "OP12-106", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643852", marketPrice: 0.10, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-color-of-observation-haki-uncommon", name: "Color of Observation Haki", number: "OP12-017", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643744", marketPrice: 0.10, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-concasser-uncommon", name: "Concasser", number: "OP12-059", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643795", marketPrice: 0.10, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-brochette-blow-uncommon", name: "Brochette Blow", number: "OP12-078", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643819", marketPrice: 0.09, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-seto-uncommon", name: "Seto", number: "OP12-103", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643849", marketPrice: 0.09, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-nekomamushi-uncommon", name: "Nekomamushi", number: "OP12-032", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643762", marketPrice: 0.09, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-emporio-ivankov-065-uncommon", name: "Emporio.Ivankov (065)", number: "OP12-065", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643804", marketPrice: 0.09, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-edward-newgate-uncommon", name: "Edward.Newgate", number: "OP12-002", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643725", marketPrice: 0.08, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kawamatsu-uncommon", name: "Kawamatsu", number: "OP12-023", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643751", marketPrice: 0.08, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-emporio-ivankov-084-uncommon", name: "Emporio.Ivankov (084)", number: "OP12-084", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643826", marketPrice: 0.07, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-wyper-uncommon", name: "Wyper", number: "OP12-114", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643861", marketPrice: 0.07, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kouzuki-oden-uncommon", name: "Kouzuki Oden", number: "OP12-004", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643727", marketPrice: 0.06, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-crocus-uncommon", name: "Crocus", number: "OP12-003", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643726", marketPrice: 0.06, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-zeff-uncommon", name: "Zeff", number: "OP12-072", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643812", marketPrice: 0.06, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jaguar-d-saul-uncommon", name: "Jaguar.D.Saul", number: "OP12-050", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643785", marketPrice: 0.05, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-mohji-cabaji-uncommon", name: "Mohji & Cabaji", number: "OP12-055", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643790", marketPrice: 0.05, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-gin-uncommon", name: "Gin", number: "OP12-068", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643807", marketPrice: 0.05, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-douglas-bullet-uncommon", name: "Douglas Bullet", number: "OP12-010", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643735", marketPrice: 0.05, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-inazuma-uncommon", name: "Inazuma", number: "OP12-083", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643825", marketPrice: 0.05, weight: 59 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-mizerka-uncommon", name: "Mizerka", number: "OP12-092", game: GAME, set: SET, setName: SET_NAME, rarity: "Uncommon", tcgplayerId: "643836", marketPrice: 0.04, weight: 59 },

  // ── Commons (~150 per box ÷ 44 cards = 3.41/card → weight 100) ───────
  { justTcgId: "one-piece-card-game-legacy-of-the-master-ms-all-sunday-common", name: "Ms. All Sunday", number: "OP12-075", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643816", marketPrice: 0.13, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-alvida-common", name: "Alvida", number: "OP12-042", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643776", marketPrice: 0.11, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-i-will-make-whitebeard-the-king-of-the-pirates-common", name: "I Will Make Whitebeard the King of the Pirates", number: "OP12-058", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643794", marketPrice: 0.11, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-roronoa-zoro-036-common", name: "Roronoa Zoro (036)", number: "OP12-036", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643767", marketPrice: 0.11, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-crocodile-common", name: "Crocodile", number: "OP12-069", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643808", marketPrice: 0.08, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jewelry-bonney-101-common", name: "Jewelry Bonney (101)", number: "OP12-101", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643846", marketPrice: 0.08, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-hatchan-common", name: "Hatchan", number: "OP12-013", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643738", marketPrice: 0.08, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-to-never-doubt-that-is-power-common", name: "To Never Doubt--That Is Power!", number: "OP12-016", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643743", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-inuarashi-common", name: "Inuarashi", number: "OP12-022", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643750", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-ice-block-pheasant-peck-common", name: "Ice Block Pheasant Peck", number: "OP12-057", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643793", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-the-extinguishes-all-sound-created-by-your-influence-technique-common", name: 'The "Extinguishes All Sound Created by Your Influence" Technique', number: "OP12-077", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643818", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-belo-betty-common", name: "Belo Betty", number: "OP12-090", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643834", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-ursa-shock-common", name: "Ursa Shock", number: "OP12-096", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643841", marketPrice: 0.07, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-two-sword-style-rashomon-common", name: "Two-Sword Style Rashomon", number: "OP12-038", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643770", marketPrice: 0.06, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-zephyr-navy-common", name: "Zephyr(Navy)", number: "OP12-046", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643781", marketPrice: 0.06, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shanks-007-common", name: "Shanks (007)", number: "OP12-007", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643731", marketPrice: 0.06, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-baratie-common", name: "Baratie", number: "OP12-080", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643821", marketPrice: 0.06, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-carmen-common", name: "Carmen", number: "OP12-067", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643806", marketPrice: 0.06, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-color-of-arms-haki-common", name: "Color of Arms Haki", number: "OP12-019", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643746", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-gyukimaru-common", name: "Gyukimaru", number: "OP12-024", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643752", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-fullbody-common", name: "Fullbody", number: "OP12-052", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643787", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-karasu-common", name: "Karasu", number: "OP12-085", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643827", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-donquixote-rosinante-048-common", name: "Donquixote Rosinante (048)", number: "OP12-048", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643783", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-trafalgar-lammy-common", name: "Trafalgar Lammy", number: "OP12-105", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643851", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-carne-common", name: "Carne", number: "OP12-066", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643805", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-buggy-012-common", name: "Buggy (012)", number: "OP12-012", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643737", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-we-ll-ring-the-bell-waiting-for-you-common", name: "We'll Ring the Bell Waiting for You!!", number: "OP12-116", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643863", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-helmeppo-common", name: "Helmeppo", number: "OP12-033", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643763", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-patty-common", name: "Patty", number: "OP12-074", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643815", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-morgan-common", name: "Morgan", number: "OP12-035", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643766", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-jango-common", name: "Jango", number: "OP12-045", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643780", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-kin-emon-common", name: "Kin'emon", number: "OP12-025", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643753", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-lindbergh-common", name: "Lindbergh", number: "OP12-095", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643840", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-baby-5-111-common", name: "Baby 5 (111)", number: "OP12-111", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643858", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-issho-common", name: "Issho", number: "OP12-082", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643824", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-pacifista-common", name: "Pacifista", number: "OP12-109", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643856", marketPrice: 0.05, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-bastille-common", name: "Bastille", number: "OP12-088", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643832", marketPrice: 0.04, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-duval-common", name: "Duval", number: "OP12-011", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643736", marketPrice: 0.04, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-marshall-d-teach-common", name: "Marshall.D.Teach", number: "OP12-054", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643789", marketPrice: 0.04, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-shiki-common", name: "Shiki", number: "OP12-005", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643729", marketPrice: 0.04, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-vergo-common", name: "Vergo", number: "OP12-064", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643803", marketPrice: 0.04, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-sentomaru-common", name: "Sentomaru", number: "OP12-104", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643850", marketPrice: 0.03, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-ipponmatsu-common", name: "Ipponmatsu", number: "OP12-021", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643749", marketPrice: 0.03, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-poker-common", name: "Poker", number: "OP12-091", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643835", marketPrice: 0.03, weight: 100 },
  { justTcgId: "one-piece-card-game-legacy-of-the-master-buffalo-common", name: "Buffalo", number: "OP12-110", game: GAME, set: SET, setName: SET_NAME, rarity: "Common", tcgplayerId: "643857", marketPrice: 0.03, weight: 100 },
];

export const op12RarityWeights = [
  { rarity: "Common", weight: 0 },
  { rarity: "Uncommon", weight: 0 },
  { rarity: "DON!!", weight: 0 },
  { rarity: "Leader", weight: 0 },
  { rarity: "Rare", weight: 0 },
  { rarity: "Super Rare", weight: 0 },
  { rarity: "Secret Rare", weight: 0 },
  { rarity: "Treasure Rare", weight: 0 },
];
