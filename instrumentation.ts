export async function register() {
  // Only run on the server at runtime (skip during build/prerender)
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { runSeed } = await import("@/lib/seed");
    await runSeed();

    const { runEloResetMigration } = await import("@/lib/migrations/elo-reset-v2");
    await runEloResetMigration();

    const { startReservationWorker } = await import("@/workers/reservation-worker");
    startReservationWorker();

    // Periodic matchmaking queue sweep every 5 seconds
    const { processMatchmakingQueue } = await import("@/lib/battle-matchmaker");
    setInterval(async () => {
      try {
        await processMatchmakingQueue();
      } catch (err) {
        console.error("[matchmaking] sweep error:", err);
      }
    }, 5000);
  }
}
