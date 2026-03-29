import {
  ELO_DEFAULT,
  ELO_FLOOR,
  ELO_K_NEW,
  ELO_K_EXPERIENCED,
  ELO_K_VETERAN,
  ELO_NEW_THRESHOLD,
  ELO_VETERAN_THRESHOLD,
  ELO_RANKS,
  ELO_DIVISION_SIZE,
} from "./battle-constants";

export function getKFactor(totalBattles: number): number {
  if (totalBattles < ELO_NEW_THRESHOLD) return ELO_K_NEW;
  if (totalBattles < ELO_VETERAN_THRESHOLD) return ELO_K_EXPERIENCED;
  return ELO_K_VETERAN;
}

export function getEloRank(elo: number) {
  for (let i = ELO_RANKS.length - 1; i >= 0; i--) {
    if (elo >= ELO_RANKS[i].minElo) return ELO_RANKS[i];
  }
  return ELO_RANKS[0];
}

interface EloPlayer {
  userId: string;
  elo: number;
  totalBattles: number;
  placement: number; // 1 = winner
}

/**
 * Calculate ELO changes for a multi-player battle.
 * Each player is compared pairwise against all opponents.
 * Score: 1 for each opponent placed below, 0 for each above, 0.5 for equal.
 */
export function calculateEloChanges(players: EloPlayer[]): Map<string, number> {
  const changes = new Map<string, number>();
  const n = players.length;

  for (const player of players) {
    const k = getKFactor(player.totalBattles);
    let totalExpected = 0;
    let totalScore = 0;

    for (const opponent of players) {
      if (opponent.userId === player.userId) continue;
      const expected = 1 / (1 + Math.pow(10, (opponent.elo - player.elo) / 400));
      totalExpected += expected;
      if (player.placement < opponent.placement) {
        totalScore += 1;
      } else if (player.placement === opponent.placement) {
        totalScore += 0.5;
      }
    }

    const raw = (k / (n - 1)) * (totalScore - totalExpected);
    const change = Math.sign(raw) * Math.round(Math.abs(raw));
    changes.set(player.userId, change);
  }

  return changes;
}

export function getEloDivision(elo: number): string {
  const rank = getEloRank(elo);
  if (!rank.divisions) return rank.label.en;

  const offset = elo - rank.minElo;
  const divIndex = Math.min(3, Math.floor(offset / ELO_DIVISION_SIZE));
  const divLabels = ["IV", "III", "II", "I"];
  return `${rank.label.en} ${divLabels[divIndex]}`;
}

export function softResetElo(elo: number): number {
  return Math.max(ELO_FLOOR, Math.round((elo - ELO_DEFAULT) * 0.5 + ELO_DEFAULT));
}
