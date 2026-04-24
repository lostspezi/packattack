export async function register() {
  // Only run on the server at runtime (skip during build/prerender)
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { runSeed } = await import("@/lib/seed");
    await runSeed();

    const { startReservationWorker } = await import("@/workers/reservation-worker");
    startReservationWorker();

    const { startBattleWorker } = await import("@/workers/battle-worker");
    startBattleWorker();

    // Register Mongoose post-save hooks that publish dashboard activity events.
    await import("@/lib/dashboard/activity-publisher");
  }
}
