import "server-only";
import fs from "node:fs";
import path from "node:path";

export type Task = {
  id: string;
  done: boolean;
  tags: string[];
  title: string;
  notes: string[];
};

export type Phase = { title: string; tasks: Task[] };

export type Stats = { total: number; done: number; pending: number };

export type SpecSummary = {
  slug: string;
  hasTasks: boolean;
  stats: Stats;
};

const TASK_RE = /^- \[( |x|X)\]\s+(T\d+[a-z]*)\s+(.*)$/;
const TAG_RE = /^\[([^\]]+)\]\s*/;

export function emptyStats(): Stats {
  return { total: 0, done: 0, pending: 0 };
}

export function computeStats(tasks: Task[]): Stats {
  const done = tasks.filter((t) => t.done).length;
  return { total: tasks.length, done, pending: tasks.length - done };
}

export function parseTasks(markdown: string): Phase[] {
  const phases: Phase[] = [];
  let phase: Phase | null = null;
  let current: Task | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      phase = { title: heading[1].trim(), tasks: [] };
      phases.push(phase);
      current = null;
      continue;
    }
    const m = TASK_RE.exec(line);
    if (m) {
      let rest = m[3];
      const tags: string[] = [];
      let tag: RegExpExecArray | null;
      while ((tag = TAG_RE.exec(rest))) {
        tags.push(tag[1]);
        rest = rest.slice(tag[0].length);
      }
      current = {
        id: m[2],
        done: m[1].toLowerCase() === "x",
        tags,
        title: rest.trim(),
        notes: [],
      };
      if (!phase) {
        phase = { title: "Tasks", tasks: [] };
        phases.push(phase);
      }
      phase.tasks.push(current);
      continue;
    }
    // Indented continuation lines belong to the previous task.
    if (current && /^\s+\S/.test(line)) {
      current.notes.push(line.trim().replace(/^[-*]\s+/, ""));
    } else if (line.trim() !== "") {
      current = null;
    }
  }
  return phases.filter((p) => p.tasks.length > 0);
}

function specsDir(projectPath: string) {
  return path.join(projectPath, "specs");
}

function readTasksFile(projectPath: string, slug: string): string | null {
  try {
    return fs.readFileSync(
      path.join(specsDir(projectPath), slug, "tasks.md"),
      "utf8",
    );
  } catch {
    return null;
  }
}

export function listSpecSlugs(projectPath: string): string[] {
  try {
    return fs
      .readdirSync(specsDir(projectPath), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function listSpecs(projectPath: string): SpecSummary[] {
  return listSpecSlugs(projectPath).map((slug) => {
    const md = readTasksFile(projectPath, slug);
    if (md === null) return { slug, hasTasks: false, stats: emptyStats() };
    const tasks = parseTasks(md).flatMap((p) => p.tasks);
    return { slug, hasTasks: true, stats: computeStats(tasks) };
  });
}

/** Returns null when the slug is not a real spec dir (also blocks path traversal). */
export function getSpec(
  projectPath: string,
  slug: string,
): { phases: Phase[]; hasTasks: boolean } | null {
  if (!listSpecSlugs(projectPath).includes(slug)) return null;
  const md = readTasksFile(projectPath, slug);
  if (md === null) return { phases: [], hasTasks: false };
  return { phases: parseTasks(md), hasTasks: true };
}

export function sumStats(list: Stats[]): Stats {
  const total = list.reduce((a, s) => a + s.total, 0);
  const done = list.reduce((a, s) => a + s.done, 0);
  return { total, done, pending: total - done };
}
