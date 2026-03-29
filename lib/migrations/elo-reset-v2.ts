import connectDB from "@/lib/db";
import Migration from "@/models/migration";
import User from "@/models/user";

const MIGRATION_NAME = "elo-reset-v2";

export async function runEloResetMigration(): Promise<void> {
  await connectDB();

  const existing = await Migration.findOne({ name: MIGRATION_NAME }).lean();
  if (existing) return;

  console.log(`[migration] Running ${MIGRATION_NAME}...`);

  const result = await User.updateMany(
    {},
    {
      $set: {
        elo: 800,
        "battleStats.wins": 0,
        "battleStats.losses": 0,
        "battleStats.streak": 0,
        "battleStats.bestStreak": 0,
        "battleStats.totalBattles": 0,
      },
    },
  );

  await Migration.create({ name: MIGRATION_NAME });

  console.log(`[migration] ${MIGRATION_NAME} complete. Reset ${result.modifiedCount} users to 800 Elo.`);
}
