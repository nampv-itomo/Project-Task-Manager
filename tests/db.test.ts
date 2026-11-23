import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Sqlite from "better-sqlite3";

// db.ts resolves data/projects.db against process.cwd(), so the whole test
// process is moved into a throwaway directory before the first connection.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-db-"));
process.chdir(tmp);

// Seed the pre-removal shape: task_watch exists and holds a row, so the first
// getDb() below must drop it. A plain empty temp dir would prove nothing.
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
const legacyDbPath = path.join(tmp, "data", "projects.db");
const legacy = new Sqlite(legacyDbPath);
legacy.exec(
  `CREATE TABLE task_watch (project_id INTEGER NOT NULL, slug TEXT NOT NULL, done_items TEXT NOT NULL DEFAULT '[]');
   INSERT INTO task_watch (project_id, slug) VALUES (1, 'old-task');`,
);
legacy.close();
assert.ok(fs.existsSync(legacyDbPath), "temp dir must start with the legacy database");

const db = await import("../src/lib/db.ts");

function tableNames(): string[] {
  return db
    .getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => (row as { name: string }).name);
}

function snapshotCount(projectId: number): number {
  const row = db
    .getDb()
    .prepare("SELECT COUNT(*) AS n FROM spec_watch WHERE project_id = ?")
    .get(projectId) as { n: number };
  return row.n;
}

test("opening the database creates the watch tables and drops legacy task_watch", () => {
  const names = tableNames();
  assert.ok(names.includes("projects"), "projects table missing");
  assert.ok(names.includes("spec_watch"), "spec_watch table missing");
  assert.ok(names.includes("notification_log"), "notification_log table missing");
  assert.ok(!names.includes("task_watch"), "the removed task_watch table survived");
});

test("opening the database twice is idempotent", () => {
  db.getDb();
  db.getDb();
  assert.equal(tableNames().filter((n) => n === "spec_watch").length, 1);
});

test("deleteProject removes that project's watch snapshots only", () => {
  db.insertProject("ProjA", path.join(tmp, "proj-a"));
  db.insertProject("ProjB", path.join(tmp, "proj-b"));
  const [a, b] = db.listProjects();

  const insert = db
    .getDb()
    .prepare("INSERT INTO spec_watch (project_id, slug, mode, done_ids) VALUES (?, ?, 'full', '[]')");
  insert.run(a.id, "spec-01");
  insert.run(b.id, "spec-01");

  db.deleteProject(a.id);

  assert.equal(snapshotCount(a.id), 0, "deleted project still has snapshots");
  assert.equal(snapshotCount(b.id), 1, "other project's snapshot was removed");
});

test("spec_watch keeps one row per (project, slug)", () => {
  db.insertProject("ProjC", path.join(tmp, "proj-c"));
  const c = db.listProjects().find((p) => p.name === "ProjC");
  assert.ok(c);

  const insert = db
    .getDb()
    .prepare("INSERT INTO spec_watch (project_id, slug, mode, done_ids) VALUES (?, ?, 'full', '[]')");
  insert.run(c.id, "spec-01");
  assert.throws(
    () => insert.run(c.id, "spec-01"),
    /UNIQUE constraint failed/,
    "duplicate (project_id, slug) was accepted",
  );
});
