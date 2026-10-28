import type { Stats } from "@/lib/specs";

export function StatsBadges({ stats }: { stats: Stats }) {
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Đã xong: {stats.done}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Chưa xong: {stats.pending}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Tổng: {stats.total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tiến độ"
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zinc-500">{pct}% hoàn thành</p>
    </div>
  );
}
