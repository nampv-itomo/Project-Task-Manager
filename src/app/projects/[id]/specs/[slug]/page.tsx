import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { computeStats, getSpec } from "@/lib/specs";
import { StatsBadges } from "@/components/progress";
import { RefreshButton } from "@/components/refresh-button";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chưa xong" },
  { key: "done", label: "Đã xong" },
] as const;

export default async function SpecPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/specs/[slug]">) {
  const { id, slug: rawSlug } = await params;
  const { status } = await searchParams;
  const slug = decodeURIComponent(rawSlug);
  const project = Number.isInteger(Number(id)) ? getProject(Number(id)) : undefined;
  if (!project) notFound();
  const spec = getSpec(project.path, slug);
  if (!spec) notFound();

  const filter = status === "done" || status === "pending" ? status : "all";
  const stats = computeStats(spec.phases.flatMap((p) => p.tasks));
  const base = `/projects/${project.id}/specs/${encodeURIComponent(slug)}`;

  const phases = spec.phases
    .map((p) => ({
      ...p,
      tasks: p.tasks.filter(
        (t) => filter === "all" || (filter === "done") === t.done,
      ),
    }))
    .filter((p) => p.tasks.length > 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
      <nav className="text-sm">
        <Link
          href={`/projects/${project.id}`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← {project.name}
        </Link>
      </nav>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-mono text-xl font-semibold">{slug}</h1>
        <RefreshButton />
      </header>

      {!spec.hasTasks ? (
        <p className="text-sm text-zinc-500">Spec này chưa có tasks.md.</p>
      ) : (
        <>
          <StatsBadges stats={stats} />
          <div className="flex gap-2" role="group" aria-label="Lọc theo trạng thái">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? base : `${base}?status=${f.key}`}
                aria-current={filter === f.key ? "true" : undefined}
                className={`rounded-md border px-3 py-1 text-sm ${
                  filter === f.key
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {phases.length === 0 && (
            <p className="text-sm text-zinc-500">Không có task nào khớp bộ lọc.</p>
          )}
          {phases.map((phase) => (
            <section key={phase.title} className="space-y-2">
              <h2 className="text-base font-semibold">{phase.title}</h2>
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {phase.tasks.map((t) => (
                  <li key={t.id} className="flex gap-3 p-3">
                    <span
                      className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border text-xs ${
                        t.done
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-zinc-400"
                      }`}
                      role="img"
                      aria-label={t.done ? "Đã xong" : "Chưa xong"}
                    >
                      {t.done ? "✓" : ""}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className={`text-sm ${t.done ? "text-zinc-500" : ""}`}>
                        <span className="mr-2 font-mono font-medium">{t.id}</span>
                        {t.tags.map((tag) => (
                          <span
                            key={tag}
                            className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="break-words">{t.title}</span>
                      </p>
                      {t.notes.length > 0 && (
                        <details className="text-xs text-zinc-500">
                          <summary className="cursor-pointer">
                            Ghi chú ({t.notes.length})
                          </summary>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {t.notes.map((n, i) => (
                              <li key={i} className="break-words">
                                {n}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
