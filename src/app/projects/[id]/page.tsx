import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getProject } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { projectSnapshots, recentNotifications } from "@/lib/watch/store";
import { watchStatus } from "@/lib/watch/start";
import { AutoCheckLine, NotificationLog } from "@/components/watch-status";
import { StatsBadges } from "@/components/progress";

export const dynamic = "force-dynamic";

/** Purple (0% done) -> green (100% done). Hue only; lightness is theme-driven in CSS. */
const HUE_FROM = 275;
const HUE_TO = 145;

function specFill(done: number, total: number): CSSProperties {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const hue = Math.round(HUE_FROM - (pct / 100) * (HUE_FROM - HUE_TO));
  return { width: `${pct}%`, ["--fill-hue" as string]: String(hue) } as CSSProperties;
}

/** spec_watch stores "YYYY-MM-DD HH:MM:SS" UTC, so plain string max is correct. */
function latest(values: (string | null)[]): string | null {
  return values.reduce<string | null>((max, value) => (value && value > (max ?? "") ? value : max), null);
}

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = Number.isInteger(Number(id)) ? getProject(Number(id)) : undefined;
  if (!project) notFound();

  const specs = listSpecs(project.path);
  const total = sumStats(specs.map((s) => s.stats));

  const job = watchStatus();
  const snapshots = projectSnapshots(project.id);
  const notifications = recentNotifications(project.id, 10);
  const summary = {
    tracked: snapshots.length,
    active: snapshots.filter((s) => s.mode === "full").length,
    idle: snapshots.filter((s) => s.mode === "idle").length,
    lastCheckedAt: latest(snapshots.map((s) => s.last_checked_at)),
    lastChangedAt: latest(snapshots.map((s) => s.last_changed_at)),
  };

  return (
    <main className="mx-auto flex w-full flex-col gap-6 md:h-[var(--content-h)]">
      <nav className="text-sm">
        <Link href="/projects" className="text-blue-600 hover:underline dark:text-blue-400">
          ← Dự án
        </Link>
      </nav>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="font-mono text-xs text-zinc-500">{project.path}</p>
      </header>
      <StatsBadges stats={total} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-3">
        <section aria-labelledby="specs" className="flex min-h-0 flex-col gap-3 md:col-span-2">
          <h2 id="specs" className="shrink-0 text-lg font-medium">
            Specs ({specs.length})
          </h2>
          {specs.length === 0 && (
            <p className="text-sm text-zinc-500">Không tìm thấy thư mục specs/ hoặc thư mục trống.</p>
          )}
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {specs.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/projects/${project.id}/specs/${encodeURIComponent(s.slug)}`}
                  className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-zinc-200 px-4 py-2 hover:border-blue-500 dark:border-zinc-800"
                >
                  <span
                    aria-hidden
                    className="spec-fill absolute inset-y-0 left-0"
                    style={specFill(s.stats.done, s.stats.total)}
                  />
                  <span className="relative min-w-0 flex-1 truncate font-mono text-sm font-medium">{s.slug}</span>
                  <span className="relative shrink-0 text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
                    {s.hasTasks ? `${s.stats.done}/${s.stats.total}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex min-h-0 flex-col gap-6 md:col-span-1">
          <AutoCheckLine summary={summary} enabled={job.enabled} intervalMs={job.intervalMs} />
          <NotificationLog
            rows={notifications}
            className="flex min-h-0 flex-1 flex-col gap-2"
            listClassName="min-h-0 flex-1 overflow-y-auto"
          />
        </aside>
      </div>
    </main>
  );
}
