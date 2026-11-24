import type { Stats } from "@/lib/specs";
import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack } from "@astryxdesign/core/HStack";
import { Stack } from "@astryxdesign/core/Stack";

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
  return (
    <Stack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Badge variant="success" label={`Đã xong: ${stats.done}`} />
        <Badge variant="warning" label={`Chưa xong: ${stats.pending}`} />
        <Badge variant="neutral" label={`Tổng: ${stats.total}`} />
      </HStack>
      <ProgressBar
        label="Tiến độ"
        isLabelHidden
        value={pct}
        max={100}
        variant="success"
        hasValueLabel
      />
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
  return (
    <ProgressBar
      label="Tiến độ"
      isLabelHidden
      value={pct}
      max={100}
      variant={pct === 100 ? "success" : pct > 0 ? "accent" : "neutral"}
    />
  );
}
