// ---------- Types ----------

export interface EloPlayer {
  id: string;
  elo: number;
  totalBattles: number;
}

export interface EloChange {
  id: string;
  oldElo: number;
  newElo: number;
  change: number;
}

export type Rank = "Bronze" | "Silver" | "Gold" | "Diamond" | "Champion";

// ---------- Constants ----------

export const DEFAULT_ELO = 1000;
const K_NEW = 40; // K-factor for players with < 30 battles
const K_EXPERIENCED = 20;
const NEW_PLAYER_THRESHOLD = 30;

// ---------- ELO Calculation ----------

/**
 * Calculate ELO changes for all players after a battle.
 * Uses pairwise comparison (each player vs each other player).
 * Winner scores 1 against all losers, losers score 0 against winner.
 */
export function calculateEloChanges(
  players: EloPlayer[],
  winnerId: string,
): EloChange[] {
  if (players.length < 2) return [];

  const changes: EloChange[] = [];
  const opponents = players.length - 1;

  for (const player of players) {
    const k = player.totalBattles < NEW_PLAYER_THRESHOLD ? K_NEW : K_EXPERIENCED;
    let totalChange = 0;

    // Pairwise against every other player
    for (const opponent of players) {
      if (opponent.id === player.id) continue;

      const expected = expectedScore(player.elo, opponent.elo);
      let actual: number;
      if (player.id === winnerId) {
        actual = 1; // Winner beats everyone
      } else if (opponent.id === winnerId) {
        actual = 0; // Loser loses to winner
      } else {
        actual = 0.5; // Losers draw against each other
      }
      totalChange += k * (actual - expected);
    }

    // Normalize by number of opponents to keep changes reasonable
    totalChange = totalChange / opponents;

    const newElo = Math.max(0, Math.round(player.elo + totalChange));

    changes.push({
      id: player.id,
      oldElo: player.elo,
      newElo,
      change: newElo - player.elo,
    });
  }

  return changes;
}

/**
 * Expected score of player A against player B.
 * Standard ELO formula: 1 / (1 + 10^((ratingB - ratingA) / 400))
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// ---------- Rank ----------

export function getRank(elo: number): Rank {
  if (elo >= 1600) return "Champion";
  if (elo >= 1400) return "Diamond";
  if (elo >= 1200) return "Gold";
  if (elo >= 1000) return "Silver";
  return "Bronze";
}
