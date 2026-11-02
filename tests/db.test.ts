import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// db.ts resolves data/projects.db against process.cwd(), so the whole test
// process is moved into a throwaway directory before the first connection.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-db-"));
process.chdir(tmp);

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

before(() => {
  assert.ok(!fs.existsSync(path.join(tmp, "data")), "temp dir must start clean");
});

test("opening the database creates the watch tables", () => {
  const names = tableNames();
  assert.ok(names.includes("projects"), "projects table missing");
  assert.ok(names.includes("spec_watch"), "spec_watch table missing");
  assert.ok(names.includes("notification_log"), "notification_log table missing");
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
