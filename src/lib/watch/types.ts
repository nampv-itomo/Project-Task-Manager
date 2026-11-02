/**
 * Shared types for the auto task watch job.
 * Invariant: this module is type-only (erasable syntax) so it can be imported by
 * both the Next server and plain `node --test`.
 */

/** `full` = parse tasks.md and diff every tick. `idle` = only stat tasks.md mtime. */
export type WatchMode = "full" | "idle";

/** Last known state of one task (`<project>/tasks/<slug>/todo.md`). */
export type TaskSnapshot = {
  project_id: number;
  slug: string;
  mode: WatchMode;
  /** Task item ids that were `[x]` at the time of the snapshot. */
  done_items: string[];
  total: number;
  done: number;
  pending: number;
  /** 0 = no baseline yet: the next read only seeds, it must not notify. */
  seeded: boolean;
  file_mtime_ms: number | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
};

/** Last known state of one spec (`<project>/specs/<slug>/tasks.md`). */
export type SpecSnapshot = {
  project_id: number;
  slug: string;
  mode: WatchMode;
  /** Task ids that were `[x]` at the time of the snapshot. */
  done_ids: string[];
  total: number;
  done: number;
  pending: number;
  /** 0 = no baseline yet: the next read only seeds, it must not notify. */
  seeded: boolean;
  file_mtime_ms: number | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
};

/** Result of comparing two done-id snapshots of the same spec. */
export type WatchDiff = {
  /** Ids done now but not done in the snapshot, in current-snapshot order. */
  newlyDone: string[];
  /** Ids done in the snapshot but pending now. Never triggers a notification. */
  reopened: string[];
};

/** Task counts used to decide whether a spec just reached 100%. */
export type TaskCounts = { total: number; done: number; pending: number };

/** One intended Telegram message, persisted before sending. */
export type NotifyPayload = {
  projectId: number | null;
  projectName: string;
  /** null when one message bundles several specs. */
  slug: string | null;
  kind: "tasks_done" | "spec_completed";
  taskIds: string[];
  message: string;
};

export type NotifyStatus = "pending" | "sent" | "skipped_no_config" | "error";

/** A stored notification row, as read back for the UI and the send queue. */
export type NotificationRow = {
  id: number;
  created_at: string;
  project_id: number | null;
  project_name: string;
  slug: string | null;
  kind: "tasks_done" | "spec_completed";
  task_ids: string[];
  message: string;
  status: NotifyStatus;
  attempts: number;
  last_error: string | null;
};
