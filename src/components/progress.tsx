import type { Stats } from "@/lib/specs";
import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack } from "@astryxdesign/core/HStack";
import { Stack } from "@astryxdesign/core/Stack";

/**
 * The 20%-step colour ramp shared by **every** progress bar in the app.
 *
 * `>0%` starts at orange and each further 20% step moves one notch toward
 * green, so 100% is the last (green) step; `0%` stays neutral — an empty bar
 * must never look like it has progress. The five steps are the
 * by a wrapper class on Astryx `Stack` (a plain block wrapper — `ProgressBar`
 * keeps its `width: 100%` track) and painted onto the component's own theming
 * class in `globals.css`. `variant` still carries a semantic value (`neutral` /
 * `warning` / `success`) because `ProgressBar` exposes no colour prop beyond it,
 * and the % is always double-encoded (bar width + `done/total` badge / value
 * label), so colour is decoration, never the sole channel.
 */
export function progressBucket(pct: number): number {
  if (pct <= 0) return 0;
  return Math.min(5, Math.ceil(pct / 20));
}

/** Stock variant matching a ramp step — the accessible, non-visual channel. */
function rampVariant(bucket: number): "neutral" | "warning" | "success" {
  if (bucket === 0) return "neutral";
  return bucket === 5 ? "success" : "warning";
}

/**
 * Aggregate progress for one scope (a page total, one project, one spec):
 * done / pending / total pills plus a `role="progressbar"` track with the % as
 * its value label. `%` is shown three ways (pills, track width, value label),
 * so colour is never the only channel.
 *
 * Invariant — this stays a Server Component, so it must not pass a **function**
 * prop to an Astryx Client Component (`ProgressBar.formatValueLabel`, `Table`
 * renderers, …): React serialises props across the server→client boundary and
 * throws `Functions cannot be passed directly to Client Components`, which 500s
 * the page and kills `next build` at *Collecting page data*. Keep the default
 * percentage formatting, or precompute a string and pass it as a plain prop.
 */
export function StatsBadges({ stats }: { stats: Stats }) {
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const bucket = progressBucket(pct);
  return (
    <Stack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Badge variant="success" label={`Đã xong: ${stats.done}`} />
        <Badge variant="warning" label={`Chưa xong: ${stats.pending}`} />
        <Badge variant="neutral" label={`Tổng: ${stats.total}`} />
      </HStack>
      <Stack className={`progress-ramp${bucket}`}>
        <ProgressBar
          label="Tiến độ"
          isLabelHidden
          value={pct}
          max={100}
          variant={rampVariant(bucket)}
          hasValueLabel
        />
      </Stack>
    </Stack>
  );
}

/**
 * The per-row bar used inside `List`/`ListItem` rows (spec rows on
 * `/projects/[id]`, phase rows on `/projects/[id]/specs/[slug]`). Always called
 * with **full** stats, never a filtered subset — the same number the row's
 * `done/total` badge shows.
 *
 * Replaced the old bespoke `<ProgressFill>` (an `aria-hidden` span painted
 * behind the whole row with a purple→green hue ramp): `List`/`ListItem` expose
 * no full-bleed background slot and `ProgressBar` exposes no `className`, so
 * the fill needed a theme/CSS override on `astryx-item` to survive. Stock
 * `ProgressBar` keeps the same encoding (width + % text) with theme variants
 * instead of raw `hsl()` tokens, and drops the AA-over-pastel-fill problem.
 */
export function RowProgress({ stats }: { stats: Stats }) {
  const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
  const bucket = progressBucket(pct);
  return (
    <Stack className={`progress-ramp${bucket}`}>
      <ProgressBar
        label="Tiến độ"
        isLabelHidden
        value={pct}
        max={100}
        variant={rampVariant(bucket)}
      />
    </Stack>
  );
}

/**
 * The `done/total` pill that closes a row whose second line is `RowProgress`
 * (spec rows on `/projects/[id]`, project rows on `/`).
 *
 * It **must** keep a fixed width, or the bars above it cannot line up: `Item`'s
 * end slot is `flex: 0 0 auto` and `Badge` is `width: fit-content`, so a pill as
 * wide as its own label eats a different amount of width from the label column
 * on every row — and the `width: 100%` progress track lives in that column. A
 * `5/5` row then draws a visibly longer bar than a `100/100` row of the same
 * list, even though both bars mean the same 0–100%. Fixing the pill's width
 * fixes the bars: every row's label column, and so every track, is identical.
 *
 * `w-20` is 5rem on the theme's own spacing scale (`--spacing` → `--spacing-1`,
 * bridged by `core/tailwind-theme.css`) — wide enough for the widest count this
 * app shows (`486/488`) at the supporting text size, with `tabular-nums` so
 * digits don't shift inside the pill between rows. Both are Tailwind utilities,
 * which `globals.css` puts in the `utilities` layer — last in the cascade, so
 * they override `Badge`'s `fit-content` without touching the theme. `xstyle` is
 * not an option here: this app has no `@stylexjs/babel-plugin`, so
 * `stylex.create()` throws at runtime.
 *
 * A label wider than the column (a row with no `tasks.md`, or a project folder
 * that has disappeared) is clipped by `Badge`'s own `minWidth: 0` + ellipsis,
 * and `Badge` keeps the full text in `title` — never colour-only, never lost.
 */
export function CountBadge({
  stats,
  hasTasks = true,
  variant,
}: {
  stats: Stats;
  /** False when the spec has no `tasks.md` at all: the pill reads `—`, not `0/0`. */
  hasTasks?: boolean;
  /** Overrides the done/pending colour, e.g. `error` for a missing project folder. */
  variant?: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <Badge
      className="w-20 tabular-nums"
      variant={
        variant ??
        (hasTasks && stats.total > 0 && stats.done === stats.total ? "success" : "neutral")
      }
      label={hasTasks ? `${stats.done}/${stats.total}` : "—"}
    />
  );
}
