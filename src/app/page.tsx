import fs from "node:fs";
import Link from "next/link";
import { listProjects } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { AddProjectForm } from "@/components/add-project-form";
import { StatsBadges } from "@/components/progress";
import { RemoveProjectButton } from "@/components/remove-project-button";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = listProjects().map((p) => {
    const specs = listSpecs(p.path);
    return {
      ...p,
      exists: fs.existsSync(p.path),
      specCount: specs.length,
      stats: sumStats(specs.map((s) => s.stats)),
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Quản lý dự án</h1>
        <p className="text-sm text-zinc-500">Theo dõi tiến độ task (Spec Kit) của các dự án trên máy này.</p>
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
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Chưa có dự án nào. Thêm đường dẫn ở trên để bắt đầu.
          </p>
        )}
        <ul className="grid gap-4">
          {projects.map((p) => (
            <li key={p.id} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
              ) : p.specCount === 0 ? (
                <p className="text-sm text-zinc-500">Chưa có thư mục specs/.</p>
              ) : (
                <>
                  <p className="text-xs text-zinc-500">{p.specCount} spec</p>
                  <StatsBadges stats={p.stats} />
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
