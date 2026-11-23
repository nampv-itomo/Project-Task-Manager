import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { computeStats, getSpec } from "@/lib/specs";
import { getSnapshot } from "@/lib/watch/store";
import { watchStatus } from "@/lib/watch/start";
import { AutoCheckLine } from "@/components/watch-status";
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
  const job = watchStatus();
  const watched = getSnapshot(project.id, slug);
  const watchSummary = {
    tracked: watched ? 1 : 0,
    active: watched?.mode === "full" ? 1 : 0,
    idle: watched?.mode === "idle" ? 1 : 0,
    lastCheckedAt: watched?.last_checked_at ?? null,
    lastChangedAt: watched?.last_changed_at ?? null,
    mode: watched?.mode,
  };
  const base = `/projects/${project.id}/specs/${encodeURIComponent(slug)}`;

  const phases = spec.phases
    .map((phase) => ({
      phase,
      stats: computeStats(phase.tasks),
      tasks: phase.tasks.filter(
        (t) => filter === "all" || (filter === "done") === t.done,
      ),
    }))
    .filter((p) => p.tasks.length > 0);

  return (
    <main className="mx-auto w-full space-y-6">
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
          <AutoCheckLine
            summary={watchSummary}
            enabled={job.enabled}
            intervalMs={job.intervalMs}
            heading="Auto-check cho spec này"
          />
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
          {phases.map(({ phase, stats, tasks }) => (
            <section key={phase.title} className="space-y-2">
              <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <summary className="flex cursor-pointer items-center justify-between gap-3 list-none px-3 py-2 text-base font-semibold">
                  <span className="flex items-center gap-2">
                    <svg
                      className="size-3 shrink-0 text-zinc-400 transition-transform [open]:rotate-90"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {phase.title}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {filter === "pending"
                      ? `${stats.pending}/${stats.total}`
                      : `${stats.done}/${stats.total}`}
                  </span>
                </summary>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {tasks.map((t) => (
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
              </details>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
