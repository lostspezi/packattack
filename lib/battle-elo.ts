import {
  ELO_DEFAULT,
  ELO_K_NEW,
  ELO_K_EXPERIENCED,
  ELO_NEW_THRESHOLD,
  ELO_RANKS,
} from "./battle-constants";

export function getKFactor(totalBattles: number): number {
  return totalBattles < ELO_NEW_THRESHOLD ? ELO_K_NEW : ELO_K_EXPERIENCED;
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

    const change = Math.round(k * (totalScore - totalExpected));
    changes.set(player.userId, change);
  }

  return changes;
}

export function softResetElo(elo: number): number {
  return Math.round((elo - ELO_DEFAULT) * 0.5 + ELO_DEFAULT);
}
