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

function getDb(): Database.Database {
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
    )`);
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
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
}
