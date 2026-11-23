import fs from "node:fs";
import Link from "next/link";
import { listProjects } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { StatsBadges } from "@/components/progress";

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

  const total = sumStats(projects.map((p) => p.stats));
  const specCount = projects.reduce((n, p) => n + p.specCount, 0);
  const pct = total.total ? Math.round((total.done / total.total) * 100) : 0;

  const kpis = [
    { label: "Dự án", value: projects.length },
    { label: "Spec", value: specCount },
    { label: "Task đã xong", value: total.done },
    { label: "Task chưa xong", value: total.pending },
  ];

  return (
    <main className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tổng quan</h1>
        <p className="text-sm text-zinc-500">
          Tiến độ task (Spec Kit) trên tất cả dự án.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Chưa có dự án nào.{" "}
          <Link href="/projects" className="text-blue-600 hover:underline dark:text-blue-400">
            Thêm dự án
          </Link>{" "}
          để bắt đầu.
        </p>
      ) : (
        <>
          <section aria-labelledby="kpi" className="space-y-3">
            <h2 id="kpi" className="text-lg font-medium">
              Toàn cục — {pct}% hoàn thành
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((k) => (
                <li
                  key={k.label}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <p className="text-2xl font-semibold">{k.value}</p>
                  <p className="text-xs text-zinc-500">{k.label}</p>
                </li>
              ))}
            </ul>
            <StatsBadges stats={total} />
          </section>

          <section aria-labelledby="per-project" className="space-y-3">
            <h2 id="per-project" className="text-lg font-medium">
              Tiến độ từng dự án
            </h2>
            <ul className="grid gap-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block space-y-3 rounded-lg border border-zinc-200 p-4 cursor-pointer hover:border-blue-500 dark:border-zinc-800"
                  >
                    <span className="font-medium">{p.name}</span>
                    {!p.exists ? (
                      <p className="text-sm text-red-600">Không tìm thấy thư mục.</p>
                    ) : p.specCount === 0 ? (
                      <p className="text-sm text-zinc-500">Chưa có thư mục specs/.</p>
                    ) : (
                      <StatsBadges stats={p.stats} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
