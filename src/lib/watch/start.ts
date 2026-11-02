import "server-only";
import { runWatchTick } from "./runner.ts";
import { telegramConfig } from "./telegram.ts";

export const DEFAULT_INTERVAL_MS = 60_000;
/** Anything faster risks two ticks competing for the same SQLite/send queue. */
export const MIN_INTERVAL_MS = 5_000;

type WatchHandle = { interval: ReturnType<typeof setInterval>; startedAt: string; intervalMs: number };
type GlobalWithWatch = typeof globalThis & { __ptmWatch?: WatchHandle };

/** Survives dev hot reload: the handle lives on globalThis, not in module scope. */
function handle(): WatchHandle | undefined {
  return (globalThis as GlobalWithWatch).__ptmWatch;
}

export function watchEnabled(): boolean {
  return process.env.TASK_WATCH_ENABLED !== "0";
}

export function watchIntervalMs(): number {
  const raw = Number(process.env.TASK_WATCH_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < MIN_INTERVAL_MS) return DEFAULT_INTERVAL_MS;
  return Math.floor(raw);
}

export function watchStatus(): { running: boolean; enabled: boolean; intervalMs: number; startedAt: string | null } {
  const current = handle();
  return {
    running: Boolean(current),
    enabled: watchEnabled(),
    intervalMs: current?.intervalMs ?? watchIntervalMs(),
    startedAt: current?.startedAt ?? null,
  };
}

export type StartWatchOptions = {
  /** Injectable so the loop is testable without touching SQLite/Telegram. */
  tick?: () => Promise<unknown>;
  /** Test override; production reads TASK_WATCH_INTERVAL_MS. */
  intervalMs?: number;
};

/**
 * Start the job. Called once from instrumentation register(), and idempotent:
 * a second call (hot reload, duplicated register) never stacks intervals.
 */
export function startWatch(options: StartWatchOptions = {}): boolean {
  if (process.env.NEXT_RUNTIME !== "nodejs") return false;
  if (!watchEnabled()) {
    console.log("[watch] disabled (TASK_WATCH_ENABLED=0)");
    return false;
  }
  if (handle()) return false;

  const tick = options.tick ?? runWatchTick;
  const intervalMs = options.intervalMs ?? watchIntervalMs();
  const run = () => {
    void tick().catch((error: unknown) => {
      console.error("[watch] tick failed:", error instanceof Error ? error.message : error);
    });
  };

  const interval = setInterval(run, intervalMs);
  // The job must not keep the process alive on its own.
  interval.unref();
  (globalThis as GlobalWithWatch).__ptmWatch = {
    interval,
    startedAt: new Date().toISOString(),
    intervalMs,
  };

  const bot = telegramConfig();
  console.log(
    `[watch] started interval=${intervalMs}ms telegram=${bot ? "configured" : "missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID"}`,
  );
  // Seed baselines right away instead of waiting a full interval.
  run();
  return true;
}

export function stopWatch(): void {
  const current = handle();
  if (!current) return;
  clearInterval(current.interval);
  delete (globalThis as GlobalWithWatch).__ptmWatch;
  console.log("[watch] stopped");
}
