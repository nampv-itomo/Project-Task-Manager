import type { TaskCounts, WatchDiff } from "./types";

/**
 * Compare two done-task-id snapshots of the same spec.
 * Invariant: ids are compared as a set, so reordering or reformatting tasks.md
 * never produces a phantom notification. Order of the output follows the input
 * arrays, which keeps notification text stable.
 */
export function diffSnapshots(
  prevDone: string[],
  currentDone: string[],
): WatchDiff {
  const prev = new Set(prevDone);
  const current = new Set(currentDone);
  const reported = new Set<string>();
  const newlyDone: string[] = [];
  for (const id of currentDone) {
    if (!prev.has(id) && !reported.has(id)) {
      reported.add(id);
      newlyDone.push(id);
    }
  }
  return {
    newlyDone,
    reopened: prevDone.filter((id) => !current.has(id)),
  };
}

/**
 * True only when a spec that had pending tasks now has none.
 * Invariant: a spec that was already complete, or one with no tasks, is never
 * "completed" again — that would re-notify on every tick.
 */
export function isSpecCompleted(prev: TaskCounts, current: TaskCounts): boolean {
  return prev.pending > 0 && current.pending === 0 && current.total > 0;
}
