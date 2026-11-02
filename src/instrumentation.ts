/**
 * Next.js server bootstrap. register() runs once per server process, which is
 * where the 60s task-watch interval belongs (PM2 runs a single instance).
 * Dynamic import keeps this out of the Edge bundle, per the instrumentation guide.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWatch } = await import("./lib/watch/start.ts");
  startWatch();
}
