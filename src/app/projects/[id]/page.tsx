import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { projectSnapshots, recentNotifications } from "@/lib/watch/store";
import { watchStatus } from "@/lib/watch/start";
import { AutoCheckLine, NotificationLog } from "@/components/watch-status";
import { StatsBadges } from "@/components/progress";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto w-full max-w-4xl space-y-6">
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

      <section aria-labelledby="specs" className="space-y-3">
        <h2 id="specs" className="text-lg font-medium">
          Specs ({specs.length})
        </h2>
        {specs.length === 0 && (
          <p className="text-sm text-zinc-500">Không tìm thấy thư mục specs/ hoặc thư mục trống.</p>
        )}
        <ul className="grid gap-3">
          {specs.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/projects/${project.id}/specs/${encodeURIComponent(s.slug)}`}
                className="block space-y-3 rounded-lg border border-zinc-200 p-4 hover:border-blue-500 dark:border-zinc-800"
              >
                <span className="font-mono text-sm font-medium">{s.slug}</span>
                {s.hasTasks ? (
                  <StatsBadges stats={s.stats} />
                ) : (
                  <p className="text-sm text-zinc-500">Chưa có tasks.md</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AutoCheckLine summary={summary} enabled={job.enabled} intervalMs={job.intervalMs} />

      <NotificationLog rows={notifications} />
    </main>
  );
}
