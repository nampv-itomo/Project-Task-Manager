import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Project = {
  id: number;
  name: string;
  path: string;
  created_at: string;
};

const globalForDb = globalThis as unknown as { __ptmDb?: Database.Database };

/** Shared connection for the whole app: one process, one WAL database. */
export function getDb(): Database.Database {
  if (!globalForDb.__ptmDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "projects.db"));
    db.pragma("journal_mode = WAL");
    db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS spec_watch (
      project_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'full',
      done_ids TEXT NOT NULL DEFAULT '[]',
      total INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      pending INTEGER NOT NULL DEFAULT 0,
      seeded INTEGER NOT NULL DEFAULT 0,
      file_mtime_ms INTEGER,
      last_checked_at TEXT,
      last_changed_at TEXT,
      PRIMARY KEY (project_id, slug)
    );
    CREATE TABLE IF NOT EXISTS task_watch (
      project_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'full',
      done_items TEXT NOT NULL DEFAULT '[]',
      total INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      pending INTEGER NOT NULL DEFAULT 0,
      seeded INTEGER NOT NULL DEFAULT 0,
      file_mtime_ms INTEGER,
      last_checked_at TEXT,
      last_changed_at TEXT,
      PRIMARY KEY (project_id, slug)
    );
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_id INTEGER,
      project_name TEXT NOT NULL,
      slug TEXT,
      kind TEXT NOT NULL,
      task_ids TEXT NOT NULL DEFAULT '[]',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );`);
    globalForDb.__ptmDb = db;
  }
  return globalForDb.__ptmDb;
}

export function listProjects(): Project[] {
  return getDb()
    .prepare("SELECT * FROM projects ORDER BY created_at DESC, id DESC")
    .all() as Project[];
}

export function getProject(id: number): Project | undefined {
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | Project
    | undefined;
}

export function insertProject(name: string, projectPath: string): void {
  getDb()
    .prepare("INSERT INTO projects (name, path) VALUES (?, ?)")
    .run(name, projectPath);
}

export function deleteProject(id: number): void {
  // spec_watch has no FK cascade: drop the project's snapshots in the same
  // transaction so no orphan row can be polled by the watch job.
  const remove = getDb().transaction((projectId: number) => {
    getDb().prepare("DELETE FROM spec_watch WHERE project_id = ?").run(projectId);
    getDb().prepare("DELETE FROM task_watch WHERE project_id = ?").run(projectId);
    getDb().prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  });
  remove(id);
}
