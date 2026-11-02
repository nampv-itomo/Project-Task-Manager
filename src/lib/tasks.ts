import "server-only";
import fs from "node:fs";
import path from "node:path";

export type TaskItem = {
  id: string;
  done: boolean;
  tags: string[];
  title: string;
  notes: string[];
};

export type TaskSection = { title: string; items: TaskItem[] };

export type Stats = { total: number; done: number; pending: number };

export type TaskSummary = {
  slug: string;
  hasTasks: boolean;
  stats: Stats;
};

const TASK_RE = /^- \[( |x|X)\]\s+(T\d+[a-z]*)\s+(.*)$/;
const TAG_RE = /^\[([^\]]+)\]\s*/;

export function emptyStats(): Stats {
  return { total: 0, done: 0, pending: 0 };
}

export function computeStats(items: TaskItem[]): Stats {
  const done = items.filter((t) => t.done).length;
  return { total: items.length, done, pending: items.length - done };
}

export function parseTodo(markdown: string): TaskSection[] {
  const sections: TaskSection[] = [];
  let section: TaskSection | null = null;
  let currentItem: TaskItem | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      section = { title: heading[1].trim(), items: [] };
      sections.push(section);
      currentItem = null;
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
      currentItem = {
        id: m[2],
        done: m[1].toLowerCase() === "x",
        tags,
        title: rest.trim(),
        notes: [],
      };
      if (!section) {
        section = { title: "Tasks", items: [] };
        sections.push(section);
      }
      section.items.push(currentItem);
      continue;
    }
    // Indented continuation lines belong to the previous item.
    if (currentItem && /^\s+\S/.test(line)) {
      currentItem.notes.push(line.trim().replace(/^[-*]\s+/, ""));
    } else if (line.trim() !== "") {
      currentItem = null;
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function tasksDir(projectPath: string) {
  return path.join(projectPath, "tasks");
}

function readTodoFile(projectPath: string, slug: string): string | null {
  try {
    return fs.readFileSync(
      path.join(tasksDir(projectPath), slug, "todo.md"),
      "utf8",
    );
  } catch {
    return null;
  }
}

export function listTaskSlugs(projectPath: string): string[] {
  try {
    return fs
      .readdirSync(tasksDir(projectPath), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function listTasks(projectPath: string): TaskSummary[] {
  return listTaskSlugs(projectPath).map((slug) => {
    const md = readTodoFile(projectPath, slug);
    if (md === null) return { slug, hasTasks: false, stats: emptyStats() };
    const tasks = parseTodo(md).flatMap((p) => p.items);
    return { slug, hasTasks: true, stats: computeStats(tasks) };
  });
}

/** Returns null when the slug is not a real task dir (also blocks path traversal). */
export function getTask(
  projectPath: string,
  slug: string,
): { sections: TaskSection[]; hasTasks: boolean } | null {
  if (!listTaskSlugs(projectPath).includes(slug)) return null;
  const md = readTodoFile(projectPath, slug);
  if (md === null) return { sections: [], hasTasks: false };
  return { sections: parseTodo(md), hasTasks: true };
}

export function sumStats(list: Stats[]): Stats {
  const total = list.reduce((a, s) => a + s.total, 0);
  const done = list.reduce((a, s) => a + s.done, 0);
  return { total, done, pending: total - done };
}