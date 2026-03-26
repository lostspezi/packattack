export async function register() {
  // Only run seed on the server (not in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runSeed } = await import("@/lib/seed");
    await runSeed();
  }
}
