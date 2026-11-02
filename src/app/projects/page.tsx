import fs from "node:fs";
import Link from "next/link";
import { listProjects } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { listTasks } from "@/lib/tasks";
import { AddProjectForm } from "@/components/add-project-form";
import { StatsBadges } from "@/components/progress";
import { RemoveProjectButton } from "@/components/remove-project-button";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const projects = listProjects().map((p) => {
    const specs = listSpecs(p.path);
    const tasks = listTasks(p.path);
    const taskStats = sumStats(tasks.map((t) => t.stats));
    return {
      ...p,
      exists: fs.existsSync(p.path),
      specCount: specs.length,
      taskCount: tasks.length,
      specStats: sumStats(specs.map((s) => s.stats)),
      taskStats,
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dự án</h1>
        <p className="text-sm text-zinc-500">
          Danh sách dự án trên máy này (mỗi dự án đọc từ thư mục specs/).
        </p>
      </header>

      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className="text-lg font-medium">
          Thêm dự án
        </h2>
        <AddProjectForm />
      </section>

      <section aria-labelledby="list" className="space-y-3">
        <h2 id="list" className="text-lg font-medium">
          Dự án ({projects.length})
        </h2>
        {projects.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Chưa có dự án nào. Thêm đường dẫn ở trên để bắt đầu.
          </p>
        )}
        <ul className="grid gap-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-base font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {p.name}
                  </Link>
                  <p className="truncate font-mono text-xs text-zinc-500" title={p.path}>
                    {p.path}
                  </p>
                </div>
                <RemoveProjectButton id={p.id} name={p.name} />
              </div>
              {!p.exists ? (
                <p className="text-sm text-red-600">Không tìm thấy thư mục.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{p.specCount} spec</span>
                    <span>{p.taskCount} task</span>
                  </div>
                  <div className="flex gap-3">
                    <StatsBadges stats={p.specStats} />
                    {p.taskCount > 0 && <StatsBadges stats={p.taskStats} />}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
