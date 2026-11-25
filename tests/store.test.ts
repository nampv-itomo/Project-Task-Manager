import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SpecSnapshot } from "../src/lib/watch/types.ts";

// db.ts resolves data/projects.db against process.cwd(): isolate this suite in a
// throwaway directory so tests never touch the real database.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-store-"));
process.chdir(tmp);

const { getDb } = await import("../src/lib/db.ts");
const store = await import("../src/lib/watch/store.ts");

function seedSnapshot(overrides: Partial<SpecSnapshot> = {}): SpecSnapshot {
  return {
    project_id: 1,
    slug: "spec-01-us1",
    mode: "full",
    done_ids: ["T001", "T002"],
    total: 5,
    done: 2,
    pending: 3,
    seeded: true,
    file_mtime_ms: 1700000000000,
    last_checked_at: "2026-01-01 10:00:00",
    last_changed_at: "2026-01-01 09:00:00",
    ...overrides,
  };
}

test("getSnapshot returns null for a spec that was never watched", () => {
  assert.equal(store.getSnapshot(99, "spec-01"), null);
});

test("saveSnapshot inserts a row and reads it back unchanged", () => {
  store.saveSnapshot(seedSnapshot());
  const row = store.getSnapshot(1, "spec-01-us1");
  assert.ok(row);
  assert.deepEqual(row.done_ids, ["T001", "T002"]);
  assert.equal(row.mode, "full");
  assert.equal(row.pending, 3);
  assert.equal(row.seeded, true);
  assert.equal(row.file_mtime_ms, 1700000000000);
});

test("saveSnapshot updates the existing row instead of adding a second one", () => {
  store.saveSnapshot(seedSnapshot({ done_ids: ["T001"], done: 1, pending: 4 }));
  store.saveSnapshot(
    seedSnapshot({ done_ids: ["T001", "T002", "T003"], done: 3, pending: 2, mode: "idle" }),
  );
  const row = store.getSnapshot(1, "spec-01-us1");
  assert.ok(row);
  assert.deepEqual(row.done_ids, ["T001", "T002", "T003"]);
  assert.equal(row.pending, 2);
  assert.equal(row.mode, "idle");
  const count = getDb()
    .prepare("SELECT COUNT(*) AS n FROM spec_watch WHERE project_id = 1 AND slug = 'spec-01-us1'")
    .get() as { n: number };
  assert.equal(count.n, 1);
});

test("a corrupt done_ids column is read as an empty list", () => {
  getDb()
    .prepare("UPDATE spec_watch SET done_ids = 'not json' WHERE project_id = 1 AND slug = 'spec-01-us1'")
    .run();
  const row = store.getSnapshot(1, "spec-01-us1");
  assert.ok(row);
  assert.deepEqual(row.done_ids, []);
});

test("enqueueNotification creates a pending row that the sender queue picks up", () => {
  store.enqueueNotification({
    projectId: 1,
    projectName: "ProjA",
    slug: null,
    kind: "tasks_done",
    taskIds: ["T004", "T005"],
    message: "ProjA · 3/5 task\n• spec-01-us1: T004, T005",
  });
  const pending = store.takePendingNotifications(10);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].project_name, "ProjA");
  assert.deepEqual(pending[0].task_ids, ["T004", "T005"]);
  assert.equal(pending[0].status, "pending");
  assert.equal(pending[0].attempts, 0);
});

test("markSent removes the row from the pending queue", () => {
  const [row] = store.takePendingNotifications(1);
  assert.ok(row);
  store.markSent(row.id);
  assert.equal(store.takePendingNotifications(10).length, 0);
  const recent = store.recentNotifications(1, 10);
  assert.equal(recent[0].status, "sent");
});

test("markFailed records the error, counts the attempt and keeps the row retryable", () => {
  store.enqueueNotification({
    projectId: 1,
    projectName: "ProjA",
    slug: "spec-01-us1",
    kind: "spec_completed",
    taskIds: ["T006"],
    message: "✅ ProjA / spec-01-us1 — 5/5 task, spec hoàn thành",
  });
  const [row] = store.takePendingNotifications(10);
  assert.ok(row);
  store.markFailed(row.id, "Telegram 429 too many requests");
  const again = store.takePendingNotifications(10);
  assert.equal(again.length, 1);
  assert.equal(again[0].attempts, 1);
  assert.equal(again[0].last_error, "Telegram 429 too many requests");
});

test("rows that failed five times are no longer retried", () => {
  const row = store.takePendingNotifications(10)[0];
  assert.ok(row);
  for (let attempt = 1; attempt < 5; attempt += 1) store.markFailed(row.id, "still failing");
  assert.equal(store.takePendingNotifications(10).length, 0);
});

test("markSkipped is terminal: a missing-config row is never retried", () => {
  store.enqueueNotification({
    projectId: 1,
    projectName: "ProjA",
    slug: "spec-01-us1",
    kind: "tasks_done",
    taskIds: ["T007"],
    message: "ProjA · 4/5 task\n• spec-01-us1: T007",
  });
  const [row] = store.takePendingNotifications(10);
  assert.ok(row);
  store.markSkipped(row.id);
  assert.equal(store.takePendingNotifications(10).length, 0);
  assert.equal(store.recentNotifications(1, 10)[0].status, "skipped_no_config");
});

test("recentNotifications returns newest first and only the asked project", () => {
  store.enqueueNotification({
    projectId: 2,
    projectName: "ProjB",
    slug: "spec-02",
    kind: "tasks_done",
    taskIds: ["T100"],
    message: "ProjB · 1/2 task\n• spec-02: T100",
  });
  const projBRow = store.takePendingNotifications(10).find((n) => n.project_name === "ProjB");
  assert.ok(projBRow);
  store.markSkipped(projBRow.id);

  const projA = store.recentNotifications(1, 10);
  assert.ok(projA.length >= 2);
  assert.ok(projA.every((n) => n.project_id === 1));
  const projB = store.recentNotifications(2, 10);
  assert.equal(projB.length, 1);
  assert.equal(projB[0].project_name, "ProjB");
});

test("pruneNotifications keeps the newest rows and drops the oldest", () => {
  for (let i = 0; i < 250; i += 1) {
    store.enqueueNotification({
      projectId: 3,
      projectName: "ProjC",
      slug: `spec-${i}`,
      kind: "tasks_done",
      taskIds: [`T${i}`],
      message: `ProjC · ${i}/500 task\n• spec-${i}: T${i}`,
    });
  }
  const total = () =>
    (getDb().prepare("SELECT COUNT(*) AS n FROM notification_log WHERE project_id = 3").get() as { n: number }).n;
  assert.equal(total(), 250);
  store.pruneNotifications(200);
  assert.equal(total(), 200);
  const kept = store.recentNotifications(3, 300);
  assert.equal(kept.length, 200);
  assert.equal(kept[0].slug, "spec-249");
  assert.equal(kept[199].slug, "spec-50");
});

test("allNotifications pages every project newest-first and reports the total", () => {
  // Self-contained: the prune test above may have dropped older rows, so seed
  // two projects here and compare against the table's real count.
  for (const [projectId, projectName] of [
    [21, "ProjX"],
    [22, "ProjY"],
  ] as const) {
    for (let i = 0; i < 3; i += 1) {
      store.enqueueNotification({
        projectId,
        projectName,
        slug: `spec-${projectName}-${i}`,
        kind: "tasks_done",
        taskIds: [`T${projectId}${i}`],
        message: `${projectName} · ${i}/3 task\n• spec: T${projectId}${i}`,
      });
    }
  }

  const first = store.allNotifications(1, 5);
  assert.equal(first.rows.length, 5);
  const total = getDb()
    .prepare("SELECT COUNT(*) AS n FROM notification_log")
    .get() as { n: number };
  assert.equal(first.total, total.n);
  // id is insertion order → ids strictly decrease across the whole result.
  const ids = first.rows.map((row) => row.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));

  const second = store.allNotifications(2, 5);
  assert.equal(second.rows.length, 5);
  assert.equal(second.total, total.n);
  assert.ok(second.rows[0].id < ids[ids.length - 1]);

  // Cross-project: the history page lists rows of every project together.
  const names = new Set(store.allNotifications(1, 500).rows.map((row) => row.project_name));
  assert.ok(names.has("ProjX") && names.has("ProjY"));

  // A page past the end is an empty slice, never an error, and total stays known.
  const beyond = store.allNotifications(Math.ceil(total.n / 5) + 1, 5);
  assert.deepEqual(beyond.rows, []);
  assert.equal(beyond.total, total.n);
});

test("projectSnapshots lists every watched spec of one project, ordered by slug", () => {
  store.saveSnapshot(seedSnapshot({ project_id: 7, slug: "spec-02-b" }));
  store.saveSnapshot(seedSnapshot({ project_id: 7, slug: "spec-01-a" }));
  store.saveSnapshot(seedSnapshot({ project_id: 8, slug: "spec-99" }));

  const rows = store.projectSnapshots(7);
  assert.deepEqual(rows.map((row) => row.slug), ["spec-01-a", "spec-02-b"]);
  assert.deepEqual(store.projectSnapshots(1234), []);
});
