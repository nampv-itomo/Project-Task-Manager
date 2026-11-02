import "server-only";
import fs from "node:fs";
import path from "node:path";
import { listProjects } from "../db.ts";
import { computeStats, listSpecSlugs, parseTasks } from "../specs.ts";
import { listTaskSlugs, parseTodo } from "../tasks.ts";
import { diffSnapshots, isSpecCompleted } from "./diff.ts";
import { buildCompletedMessage, buildDoneMessages, type SpecDelta } from "./format.ts";
import {
  NOTIFICATION_HISTORY,
  enqueueNotification,
  getSnapshot,
  getTaskSnapshot,
  pruneNotifications,
  saveSnapshot,
  saveTaskSnapshot,
} from "./store.ts";
import { flushPendingNotifications } from "./telegram.ts";
import type { TaskCounts, WatchMode } from "./types.ts";

export type ProjectReport = {
  projectId: number;
  projectName: string;
  specs: number;
  /** Specs still holding pending tasks: read and diffed on this tick. */
  active: number;
  /** Specs at zero pending: only their mtime was checked. */
  idle: number;
  tasks: number;
  /** Tasks still holding pending items: read and diffed on this tick. */
  taskActive: number;
  /** Tasks at zero pending: only their mtime was checked. */
  taskIdle: number;
  newlyDone: number;
  taskNewlyDone: number;
  queued: number;
  /** The project folder disappeared; nothing was read. */
  skippedPath: boolean;
};

export type TickReport = {
  /** True when the previous tick was still running and this one was dropped. */
  skipped: boolean;
  projects: ProjectReport[];
  sent: number;
  failed: number;
  skippedNoConfig: number;
};

/** Invariant: one tick at a time per process (SQLite + send queue are shared). */
let ticking = false;

/** SQLite-compatible UTC timestamp; the UI renders it in UTC+7. */
function nowSql(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

type SpecOutcome = {
  counts: TaskCounts;
  newlyDone: string[];
  completed: boolean;
  mode: WatchMode;
};

type TaskOutcome = {
  counts: TaskCounts;
  newlyDone: string[];
  completed: boolean;
  mode: WatchMode;
};

/**
 * Read (or skip) one spec and persist its new snapshot.
 * Invariant: a spec with zero pending tasks is only stat()'ed — its tasks.md is
 * re-read only when mtime changed, which is what keeps a big watch list cheap.
 */
function inspectSpec(
  projectId: number,
  projectPath: string,
  slug: string,
  checkedAt: string,
): SpecOutcome {
  const tasksPath = path.join(projectPath, "specs", slug, "tasks.md");
  let mtimeMs: number | null = null;
  try {
    mtimeMs = fs.statSync(tasksPath).mtimeMs;
  } catch {
    mtimeMs = null; // no tasks.md: the spec counts as empty
  }

  const snapshot = getSnapshot(projectId, slug);

  if (snapshot && snapshot.pending === 0 && snapshot.file_mtime_ms === mtimeMs) {
    saveSnapshot({ ...snapshot, last_checked_at: checkedAt });
    return {
      counts: { total: snapshot.total, done: snapshot.done, pending: snapshot.pending },
      newlyDone: [],
      completed: false,
      mode: "idle",
    };
  }

  const markdown = mtimeMs === null ? null : fs.readFileSync(tasksPath, "utf8");
  const tasks = markdown === null ? [] : parseTasks(markdown).flatMap((phase) => phase.tasks);
  const counts = computeStats(tasks);
  const currentDone = tasks.filter((task) => task.done).map((task) => task.id);
  const mode: WatchMode = counts.pending > 0 ? "full" : "idle";

  // First sight of a spec: seed silently, otherwise a project that already has
  // completed tasks would notify about all of them at once.
  if (!snapshot) {
    saveSnapshot({
      project_id: projectId,
      slug,
      mode,
      done_ids: currentDone,
      ...counts,
      seeded: true,
      file_mtime_ms: mtimeMs,
      last_checked_at: checkedAt,
      last_changed_at: null,
    });
    return { counts, newlyDone: [], completed: false, mode };
  }

  const diff = diffSnapshots(snapshot.done_ids, currentDone);
  const completed = isSpecCompleted(
    { total: snapshot.total, done: snapshot.done, pending: snapshot.pending },
    counts,
  );
  const changed =
    snapshot.file_mtime_ms !== mtimeMs || diff.newlyDone.length > 0 || diff.reopened.length > 0;

  saveSnapshot({
    project_id: projectId,
    slug,
    mode,
    done_ids: currentDone,
    ...counts,
    seeded: true,
    file_mtime_ms: mtimeMs,
    last_checked_at: checkedAt,
    last_changed_at: changed ? checkedAt : snapshot.last_changed_at,
  });

  return { counts, newlyDone: diff.newlyDone, completed, mode };
}

/**
 * Read (or skip) one task and persist its new snapshot.
 * Similar to inspectSpec but for <project>/tasks/<slug>/todo.md
 */
function inspectTask(
  projectId: number,
  projectPath: string,
  slug: string,
  checkedAt: string,
): TaskOutcome {
  const todoPath = path.join(projectPath, "tasks", slug, "todo.md");
  let mtimeMs: number | null = null;
  try {
    mtimeMs = fs.statSync(todoPath).mtimeMs;
  } catch {
    mtimeMs = null; // no todo.md: the task counts as empty
  }

  const snapshot = getTaskSnapshot(projectId, slug);

  if (snapshot && snapshot.pending === 0 && snapshot.file_mtime_ms === mtimeMs) {
    saveTaskSnapshot({ ...snapshot, last_checked_at: checkedAt });
    return {
      counts: { total: snapshot.total, done: snapshot.done, pending: snapshot.pending },
      newlyDone: [],
      completed: false,
      mode: "idle",
    };
  }

  const markdown = mtimeMs === null ? null : fs.readFileSync(todoPath, "utf8");
  const tasks = markdown === null ? [] : parseTodo(markdown).flatMap((section) => section.items);
  const counts = computeStats(tasks);
  const currentDone = tasks.filter((task) => task.done).map((task) => task.id);
  const mode: WatchMode = counts.pending > 0 ? "full" : "idle";

  // First sight of a task: seed silently
  if (!snapshot) {
    saveTaskSnapshot({
      project_id: projectId,
      slug,
      mode,
      done_items: currentDone,
      ...counts,
      seeded: true,
      file_mtime_ms: mtimeMs,
      last_checked_at: checkedAt,
      last_changed_at: null,
    });
    return { counts, newlyDone: [], completed: false, mode };
  }

  const diff = diffSnapshots(snapshot.done_items, currentDone);
  const completed = isSpecCompleted(
    { total: snapshot.total, done: snapshot.done, pending: snapshot.pending },
    counts,
  );
  const changed =
    snapshot.file_mtime_ms !== mtimeMs || diff.newlyDone.length > 0 || diff.reopened.length > 0;

  saveTaskSnapshot({
    project_id: projectId,
    slug,
    mode,
    done_items: currentDone,
    ...counts,
    seeded: true,
    file_mtime_ms: mtimeMs,
    last_checked_at: checkedAt,
    last_changed_at: changed ? checkedAt : snapshot.last_changed_at,
  });

  return { counts, newlyDone: diff.newlyDone, completed, mode };
}

function watchProject(project: { id: number; name: string; path: string }, checkedAt: string): ProjectReport {
  const report: ProjectReport = {
    projectId: project.id,
    projectName: project.name,
    specs: 0,
    active: 0,
    idle: 0,
    tasks: 0,
    taskActive: 0,
    taskIdle: 0,
    newlyDone: 0,
    taskNewlyDone: 0,
    queued: 0,
    skippedPath: false,
  };

  if (!fs.existsSync(project.path)) {
    report.skippedPath = true;
    console.warn(`[watch] ${project.name}: skipped, path not found (${project.path})`);
    return report;
  }

  // Process specs
  const specSlugs = listSpecSlugs(project.path);
  report.specs = specSlugs.length;

  const specDeltas: SpecDelta[] = [];
  const completedSpecs: { slug: string; total: number }[] = [];
  const specTotals: TaskCounts = { total: 0, done: 0, pending: 0 };

  for (const slug of specSlugs) {
    try {
      const outcome = inspectSpec(project.id, project.path, slug, checkedAt);
      specTotals.total += outcome.counts.total;
      specTotals.done += outcome.counts.done;
      specTotals.pending += outcome.counts.pending;
      if (outcome.mode === "full") report.active += 1;
      else report.idle += 1;
      if (outcome.newlyDone.length > 0) {
        specDeltas.push({ slug, taskIds: outcome.newlyDone });
        report.newlyDone += outcome.newlyDone.length;
      }
      if (outcome.completed) completedSpecs.push({ slug, total: outcome.counts.total });
    } catch (error) {
      console.warn(`[watch] ${project.name}/${slug}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Process tasks
  const taskSlugs = listTaskSlugs(project.path);
  report.tasks = taskSlugs.length;

  const taskDeltas: SpecDelta[] = [];
  const completedTasks: { slug: string; total: number }[] = [];
  const taskTotals: TaskCounts = { total: 0, done: 0, pending: 0 };

  for (const slug of taskSlugs) {
    try {
      const outcome = inspectTask(project.id, project.path, slug, checkedAt);
      taskTotals.total += outcome.counts.total;
      taskTotals.done += outcome.counts.done;
      taskTotals.pending += outcome.counts.pending;
      if (outcome.mode === "full") report.taskActive += 1;
      else report.taskIdle += 1;
      if (outcome.newlyDone.length > 0) {
        taskDeltas.push({ slug, taskIds: outcome.newlyDone });
        report.taskNewlyDone += outcome.newlyDone.length;
      }
      if (outcome.completed) completedTasks.push({ slug, total: outcome.counts.total });
    } catch (error) {
      console.warn(`[watch] ${project.name}/${slug}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Enqueue notifications for specs
  if (specDeltas.length > 0) {
    const taskIds = specDeltas.flatMap((delta) => delta.taskIds);
    const slug = specDeltas.length === 1 ? specDeltas[0].slug : null;
    for (const message of buildDoneMessages(project.name, specTotals, specDeltas)) {
      enqueueNotification({
        projectId: project.id,
        projectName: project.name,
        slug,
        kind: "tasks_done",
        taskIds,
        message,
      });
      report.queued += 1;
    }
  }

  for (const spec of completedSpecs) {
    enqueueNotification({
      projectId: project.id,
      projectName: project.name,
      slug: spec.slug,
      kind: "spec_completed",
      taskIds: [],
      message: buildCompletedMessage(project.name, spec.slug, spec.total),
    });
    report.queued += 1;
  }

  // Enqueue notifications for tasks
  if (taskDeltas.length > 0) {
    const taskIds = taskDeltas.flatMap((delta) => delta.taskIds);
    const slug = taskDeltas.length === 1 ? taskDeltas[0].slug : null;
    for (const message of buildDoneMessages(project.name, taskTotals, taskDeltas)) {
      enqueueNotification({
        projectId: project.id,
        projectName: project.name,
        slug,
        kind: "tasks_done",
        taskIds,
        message,
      });
      report.queued += 1;
    }
  }

  for (const task of completedTasks) {
    enqueueNotification({
      projectId: project.id,
      projectName: project.name,
      slug: task.slug,
      kind: "spec_completed",
      taskIds: [],
      message: buildCompletedMessage(project.name, task.slug, task.total),
    });
    report.queued += 1;
  }

  console.log(
    `[watch] ${project.name} specs=${report.specs} active=${report.active} idle=${report.idle} tasks=${report.tasks} taskActive=${report.taskActive} taskIdle=${report.taskIdle} newlyDone=${report.newlyDone} taskNewlyDone=${report.taskNewlyDone} queued=${report.queued}`,
  );
  return report;
}

/** One full pass: retry the send queue, re-read active specs, enqueue new messages. */
export async function runWatchTick(): Promise<TickReport> {
  if (ticking) {
    console.warn("[watch] tick-skipped: previous tick still running");
    return { skipped: true, projects: [], sent: 0, failed: 0, skippedNoConfig: 0 };
  }

  ticking = true;
  const checkedAt = nowSql();
  try {
    const projects = listProjects().map((project) => watchProject(project, checkedAt));
    const sent = await flushPendingNotifications();
    pruneNotifications(NOTIFICATION_HISTORY);
    console.log(
      `[watch] tick done sent=${sent.sent} failed=${sent.failed} skippedNoConfig=${sent.skipped}`,
    );
    return {
      skipped: false,
      projects,
      sent: sent.sent,
      failed: sent.failed,
      skippedNoConfig: sent.skipped,
    };
  } finally {
    ticking = false;
  }
}
