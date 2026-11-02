import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate both the SQLite file (cwd) and the watched project directory.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-runner-"));
process.chdir(tmp);

const db = await import("../src/lib/db.ts");
const store = await import("../src/lib/watch/store.ts");
const { runWatchTick } = await import("../src/lib/watch/runner.ts");

const realFetch = globalThis.fetch;

function makeProject(name: string): { id: number; root: string } {
  const root = path.join(tmp, name);
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  db.insertProject(name, root);
  const project = db.listProjects().find((p) => p.name === name);
  assert.ok(project);
  return { id: project.id, root };
}

function writeTasks(root: string, slug: string, content: string): void {
  const dir = path.join(root, "specs", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "tasks.md"), content);
}

/** Filesystems keep sub-ms noise; pin the mtime so the idle gate is testable. */
function pinMtime(root: string, slug: string, when = new Date(1700000000000)): void {
  const file = path.join(root, "specs", slug, "tasks.md");
  fs.utimesSync(file, when, when);
}

function log(projectId: number) {
  return store.recentNotifications(projectId, 20);
}

test("the first tick seeds a baseline and sends nothing", async () => {
  const { id, root } = makeProject("ProjA");
  writeTasks(root, "spec-01-us1", "## Phase 1\n- [x] T001 done already\n- [ ] T002 pending\n");

  const report = await runWatchTick();

  assert.equal(report.projects[0].newlyDone, 0);
  assert.deepEqual(store.recentNotifications(id, 10), []);
  const snapshot = store.getSnapshot(id, "spec-01-us1");
  assert.ok(snapshot);
  assert.deepEqual(snapshot.done_ids, ["T001"]);
  assert.equal(snapshot.pending, 1);
  assert.equal(snapshot.mode, "full");
  assert.equal(snapshot.seeded, true);
});

test("a task checked on disk is reported once, in one batched message", async () => {
  const { id, root } = makeProject("ProjB");
  writeTasks(root, "spec-01", "## P\n- [ ] T001 a\n- [ ] T002 b\n- [ ] T003 c\n");
  writeTasks(root, "spec-02", "## P\n- [ ] T010 c\n- [ ] T020 d\n");
  await runWatchTick();

  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [ ] T002 b\n- [ ] T003 c\n");
  writeTasks(root, "spec-02", "## P\n- [x] T010 c\n- [ ] T020 d\n");
  const report = await runWatchTick();

  const rows = log(id);
  assert.equal(report.projects.find((p) => p.projectId === id)?.newlyDone, 2);
  // Two specs, one project -> exactly one batched message (status skipped: no creds).
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "tasks_done");
  assert.equal(rows[0].slug, null);
  assert.deepEqual(rows[0].task_ids, ["T001", "T010"]);
  assert.equal(rows[0].message, "ProjB · 2/5 task\n• spec-01: T001\n• spec-02: T010");
  assert.equal(rows[0].status, "skipped_no_config");

  // Repeating the tick with an unchanged file must not notify again.
  await runWatchTick();
  assert.equal(log(id).length, 1);
});

test("two specs finishing in one tick share one batch and get one message each", async () => {
  const { id, root } = makeProject("ProjK");
  writeTasks(root, "spec-01", "## P\n- [ ] T001 a\n");
  writeTasks(root, "spec-02", "## P\n- [ ] T010 b\n");
  await runWatchTick();

  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n");
  writeTasks(root, "spec-02", "## P\n- [x] T010 b\n");
  await runWatchTick();

  const rows = log(id);
  assert.equal(rows.length, 3);
  const batch = rows.find((row) => row.kind === "tasks_done");
  assert.ok(batch);
  assert.equal(batch.message, "ProjK · 2/2 task\n• spec-01: T001\n• spec-02: T010");
  const completions = rows.filter((row) => row.kind === "spec_completed");
  assert.deepEqual(completions.map((row) => row.slug).sort(), ["spec-01", "spec-02"]);
  assert.deepEqual(
    completions.map((row) => row.message).sort(),
    [
      "✅ ProjK / spec-01 — 1/1 task, spec hoàn thành",
      "✅ ProjK / spec-02 — 1/1 task, spec hoàn thành",
    ],
  );
});

test("a spec reaching zero pending gets its own message and drops to idle", async () => {
  const { id, root } = makeProject("ProjC");
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [ ] T002 b\n");
  await runWatchTick();

  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [x] T002 b\n");
  await runWatchTick();

  const rows = log(id);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, "spec_completed");
  assert.equal(rows[0].slug, "spec-01");
  assert.equal(rows[0].message, "✅ ProjC / spec-01 — 2/2 task, spec hoàn thành");
  const snapshot = store.getSnapshot(id, "spec-01");
  assert.ok(snapshot);
  assert.equal(snapshot.mode, "idle");
  assert.equal(snapshot.pending, 0);

  // An idle spec with an unchanged mtime is not re-read, so nothing re-notifies.
  await runWatchTick();
  assert.equal(log(id).length, 2);
});

test("an idle spec is re-armed when tasks.md is edited and reports the new task", async () => {
  const { id, root } = makeProject("ProjD");
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n");
  await runWatchTick();
  assert.equal(store.getSnapshot(id, "spec-01")?.mode, "idle");

  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [ ] T002 new pending task\n");
  await runWatchTick();
  assert.equal(store.getSnapshot(id, "spec-01")?.mode, "full");
  assert.equal(store.getSnapshot(id, "spec-01")?.pending, 1);
  assert.equal(log(id).length, 0, "a new pending task must not notify");

  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [x] T002 new pending task\n");
  await runWatchTick();
  const rows = log(id);
  assert.equal(rows.length, 2);
  const doneRow = rows.find((row) => row.kind === "tasks_done");
  assert.ok(doneRow);
  assert.deepEqual(doneRow.task_ids, ["T002"]);
});

test("mtime-only edits of an idle spec do not re-read the file", async () => {
  const { id, root } = makeProject("ProjE");
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n");
  pinMtime(root, "spec-01");
  await runWatchTick();
  assert.equal(store.getSnapshot(id, "spec-01")?.file_mtime_ms, 1700000000000);

  // Content changes but the recorded mtime is restored: the idle gate must skip it.
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [x] T999 sneaked in\n");
  pinMtime(root, "spec-01");

  await runWatchTick();
  assert.deepEqual(store.getSnapshot(id, "spec-01")?.done_ids, ["T001"]);
  assert.deepEqual(log(id), []);

  // A real edit (new mtime) is picked up.
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [x] T999 sneaked in\n");
  await runWatchTick();
  assert.deepEqual(store.getSnapshot(id, "spec-01")?.done_ids, ["T001", "T999"]);
});

test("reopening a task updates the snapshot silently", async () => {
  const { id, root } = makeProject("ProjF");
  writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [ ] T002 b\n");
  await runWatchTick();

  writeTasks(root, "spec-01", "## P\n- [ ] T001 a reopened\n- [ ] T002 b\n");
  const report = await runWatchTick();

  assert.equal(report.projects.find((p) => p.projectId === id)?.newlyDone, 0);
  assert.deepEqual(store.getSnapshot(id, "spec-01")?.done_ids, []);
  assert.equal(store.getSnapshot(id, "spec-01")?.mode, "full");
  assert.deepEqual(log(id), []);
});

test("a project whose folder disappeared is skipped without breaking the tick", async () => {
  const { id, root } = makeProject("ProjG");
  writeTasks(root, "spec-01", "## P\n- [ ] T001 a\n");
  await runWatchTick();
  fs.rmSync(root, { recursive: true, force: true });

  const report = await runWatchTick();

  const project = report.projects.find((p) => p.projectId === id);
  assert.ok(project);
  assert.equal(project.skippedPath, true);
  assert.deepEqual(log(id), []);
});

test("a spec without tasks.md is tracked as empty and never notifies", async () => {
  const { id, root } = makeProject("ProjH");
  fs.mkdirSync(path.join(root, "specs", "spec-empty"), { recursive: true });

  const report = await runWatchTick();

  const project = report.projects.find((p) => p.projectId === id);
  assert.ok(project);
  assert.equal(project.specs, 1);
  assert.equal(project.newlyDone, 0);
  const snapshot = store.getSnapshot(id, "spec-empty");
  assert.ok(snapshot);
  assert.deepEqual(snapshot.done_ids, []);
  assert.equal(snapshot.total, 0);
  assert.equal(snapshot.mode, "idle");
  assert.deepEqual(log(id), []);
});

test("a second tick started while one is running is skipped, not queued", async () => {
  const { root } = makeProject("ProjI");
  writeTasks(root, "spec-01", "## P\n- [ ] T001 a\n");
  globalThis.fetch = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  try {
    const [first, second] = await Promise.all([runWatchTick(), runWatchTick()]);
    assert.equal(first.skipped, false);
    assert.equal(second.skipped, true);
    assert.deepEqual(second.projects, []);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
});

test("notifications are marked sent when Telegram accepts them", async () => {
  const { id, root } = makeProject("ProjJ");
  writeTasks(root, "spec-01", "## P\n- [ ] T001 a\n");
  await runWatchTick();

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 })) as typeof fetch;
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  try {
    writeTasks(root, "spec-01", "## P\n- [x] T001 a\n- [ ] T002 b\n");
    const report = await runWatchTick();
    assert.equal(report.sent, 1);
    assert.equal(report.failed, 0);
    assert.equal(report.skippedNoConfig, 0);
    assert.equal(log(id)[0].status, "sent");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
});
