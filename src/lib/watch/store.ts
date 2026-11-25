import "server-only";
import { getDb } from "../db.ts";
import type { NotificationRow, NotifyPayload, SpecSnapshot } from "./types.ts";

/** A notification is retried at most this many times before it is abandoned. */
export const MAX_SEND_ATTEMPTS = 5;

/** Keep this many of the newest notification rows for the UI. */
export const NOTIFICATION_HISTORY = 200;

/** Default page size of the global notification history page (`/notifications`). */
export const NOTIFICATIONS_PER_PAGE = 20;

/** Page sizes the `/notifications` footer lets the reader pick (`?size=`). */
export const NOTIFICATIONS_PAGE_SIZES = [10, 20, 50, 100] as const;

/**
 * `?size=` from the URL, clamped to {@link NOTIFICATIONS_PAGE_SIZES} — anything
 * else (a typo, a hand-typed `?size=9999`) falls back to the default, so a
 * shared link can never ask SQLite for an unbounded page.
 */
export function normalizeNotificationSize(value: string | number | null | undefined): number {
  const size = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return (NOTIFICATIONS_PAGE_SIZES as readonly number[]).includes(size)
    ? size
    : NOTIFICATIONS_PER_PAGE;
}

type SpecWatchRow = {
  project_id: number;
  slug: string;
  mode: string;
  done_ids: string;
  total: number;
  done: number;
  pending: number;
  seeded: number;
  file_mtime_ms: number | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
};

type LogRow = {
  id: number;
  created_at: string;
  project_id: number | null;
  project_name: string;
  slug: string | null;
  kind: string;
  task_ids: string;
  message: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

/** Corrupt JSON must never kill a tick: it degrades to "no known done tasks". */
function parseIds(raw: string, context: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    console.warn(`[watch] unreadable id list for ${context}, treating as empty`);
    return [];
  }
}

function toSnapshot(row: SpecWatchRow): SpecSnapshot {
  return {
    project_id: row.project_id,
    slug: row.slug,
    mode: row.mode === "idle" ? "idle" : "full",
    done_ids: parseIds(row.done_ids, `${row.project_id}/${row.slug}`),
    total: row.total,
    done: row.done,
    pending: row.pending,
    seeded: row.seeded === 1,
    file_mtime_ms: row.file_mtime_ms,
    last_checked_at: row.last_checked_at,
    last_changed_at: row.last_changed_at,
  };
}

function toLogRow(row: LogRow): NotificationRow {
  return {
    id: row.id,
    created_at: row.created_at,
    project_id: row.project_id,
    project_name: row.project_name,
    slug: row.slug,
    kind: row.kind === "spec_completed" ? "spec_completed" : "tasks_done",
    task_ids: parseIds(row.task_ids, `notification ${row.id}`),
    message: row.message,
    status: row.status as NotificationRow["status"],
    attempts: row.attempts,
    last_error: row.last_error,
  };
}

/** Returns null when this (project, slug) has never been watched. */
export function getSnapshot(projectId: number, slug: string): SpecSnapshot | null {
  const row = getDb()
    .prepare("SELECT * FROM spec_watch WHERE project_id = ? AND slug = ?")
    .get(projectId, slug) as SpecWatchRow | undefined;
  return row ? toSnapshot(row) : null;
}

/** All watched specs of one project, ordered by slug (UI summary source). */
export function projectSnapshots(projectId: number): SpecSnapshot[] {
  const rows = getDb()
    .prepare("SELECT * FROM spec_watch WHERE project_id = ? ORDER BY slug")
    .all(projectId) as SpecWatchRow[];
  return rows.map(toSnapshot);
}

export function saveSnapshot(snapshot: SpecSnapshot): void {
  getDb()
    .prepare(
      `INSERT INTO spec_watch
        (project_id, slug, mode, done_ids, total, done, pending, seeded, file_mtime_ms, last_checked_at, last_changed_at)
       VALUES (@project_id, @slug, @mode, @done_ids, @total, @done, @pending, @seeded, @file_mtime_ms, @last_checked_at, @last_changed_at)
       ON CONFLICT (project_id, slug) DO UPDATE SET
        mode = excluded.mode,
        done_ids = excluded.done_ids,
        total = excluded.total,
        done = excluded.done,
        pending = excluded.pending,
        seeded = excluded.seeded,
        file_mtime_ms = excluded.file_mtime_ms,
        last_checked_at = excluded.last_checked_at,
        last_changed_at = excluded.last_changed_at`,
    )
    .run({
      project_id: snapshot.project_id,
      slug: snapshot.slug,
      mode: snapshot.mode,
      done_ids: JSON.stringify(snapshot.done_ids),
      total: snapshot.total,
      done: snapshot.done,
      pending: snapshot.pending,
      seeded: snapshot.seeded ? 1 : 0,
      file_mtime_ms: snapshot.file_mtime_ms,
      last_checked_at: snapshot.last_checked_at,
      last_changed_at: snapshot.last_changed_at,
    });
}

/** Persist the intended message before sending it, so a crash cannot lose it. */
export function enqueueNotification(payload: NotifyPayload): void {
  getDb()
    .prepare(
      `INSERT INTO notification_log (project_id, project_name, slug, kind, task_ids, message, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      payload.projectId,
      payload.projectName,
      payload.slug,
      payload.kind,
      JSON.stringify(payload.taskIds),
      payload.message,
    );
}

/** Oldest-first queue of messages that still have attempts left. */
export function takePendingNotifications(limit: number): NotificationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM notification_log
       WHERE status IN ('pending', 'error') AND attempts < ?
       ORDER BY id ASC LIMIT ?`,
    )
    .all(MAX_SEND_ATTEMPTS, limit) as LogRow[];
  return rows.map(toLogRow);
}

export function markSent(id: number): void {
  getDb()
    .prepare("UPDATE notification_log SET status = 'sent', last_error = NULL WHERE id = ?")
    .run(id);
}

/** Network/API failure: visible as 'error' in the UI, retried until attempts run out. */
export function markFailed(id: number, error: string): void {
  getDb()
    .prepare(
      "UPDATE notification_log SET status = 'error', attempts = attempts + 1, last_error = ? WHERE id = ?",
    )
    .run(error, id);
}

/** No Telegram config: terminal state, retried only once config is present. */
export function markSkipped(id: number): void {
  getDb()
    .prepare("UPDATE notification_log SET status = 'skipped_no_config' WHERE id = ?")
    .run(id);
}

export function recentNotifications(projectId: number, limit = 10): NotificationRow[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM notification_log WHERE project_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(projectId, limit) as LogRow[];
  return rows.map(toLogRow);
}

/**
 * One page of the notification history of **all** projects, newest first
 * (`id` is insertion order, so it is deterministic even when several rows
 * share a `created_at`). `total` is the whole table, so the UI can paginate
 * without a second query.
 */
export function allNotifications(
  page = 1,
  pageSize = NOTIFICATIONS_PER_PAGE,
): { rows: NotificationRow[]; total: number } {
  const db = getDb();
  const size = Math.max(1, Math.floor(pageSize) || NOTIFICATIONS_PER_PAGE);
  const current = Math.max(1, Math.floor(page) || 1);
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM notification_log")
    .get() as { n: number };
  const rows = db
    .prepare("SELECT * FROM notification_log ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(size, (current - 1) * size) as LogRow[];
  return { rows: rows.map(toLogRow), total: n };
}

/** Newest `keep` rows survive; id is insertion order, so it is deterministic. */
export function pruneNotifications(keep = NOTIFICATION_HISTORY): void {
  getDb()
    .prepare(
      `DELETE FROM notification_log
       WHERE id NOT IN (SELECT id FROM notification_log ORDER BY id DESC LIMIT ?)`,
    )
    .run(keep);
}
