/**
 * MongoDB Migration Script: Reset all user ELO ratings to 1000
 *
 * Run directly with mongosh:
 *   mongosh "mongodb+srv://..." scripts/reset-elo.js
 *
 * What this script does:
 * 1. Sets elo to 1000 for all users
 * 2. Resets battle stats (wins, losses, streak, bestStreak, totalBattles)
 *
 * Idempotent — safe to run multiple times (uses migration record).
 */

const MIGRATION_ID = "reset-elo-1000_2026-04-01";

const existing = db.migrations.findOne({ _id: MIGRATION_ID });
if (existing) {
  print("Migration already applied on " + existing.appliedAt + ". Skipping.");
  quit(0);
}

// 1. Reset ELO to 1000 for all users
print("--- Step 1: Reset all user ELO to 1000 ---");
let result = db.users.updateMany(
  {},
  {
    $set: {
      elo: 1000,
      "battleStats.wins": 0,
      "battleStats.losses": 0,
      "battleStats.streak": 0,
      "battleStats.bestStreak": 0,
      "battleStats.totalBattles": 0,
    },
  }
);
print("  Updated " + result.modifiedCount + " user(s).");

// 2. Record migration
db.migrations.insertOne({
  _id: MIGRATION_ID,
  appliedAt: new Date(),
  description: "Reset all user ELO to 1000 and clear battle stats for public battle launch",
});

print("\nMigration complete!");
print("  - All users now have 1000 ELO");
print("  - Battle stats have been reset");
