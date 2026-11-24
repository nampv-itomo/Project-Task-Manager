import type { CSSProperties } from "react";
import type { Stats } from "@/lib/specs";
import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack } from "@astryxdesign/core/HStack";
import { Stack } from "@astryxdesign/core/Stack";

/** Purple (0% done) -> green (100% done). Hue only; lightness is theme-driven in CSS. */
const HUE_FROM = 275;
const HUE_TO = 145;

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
 * Background progress bar for a list row: sits behind the row content
 * (`absolute inset-y-0 left-0` inside a `relative overflow-hidden` row), width
 * = % tasks done, hue ramps purple -> green. The row must render its own text
 * in `relative` spans so they stay above the fill; `aria-hidden` because the
 * row's `done/total` label already carries the same information.
 *
 * Kept as a native span on purpose: Astryx `ProgressBar` renders a standalone
 * track, not a full-bleed fill behind arbitrary row content, so this decorative
 * row fill has no component equivalent (it is `aria-hidden`; the row's own
 * text carries the value).
 */
export function ProgressFill({ stats }: { stats: Stats }) {
  const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
  const hue = Math.round(HUE_FROM - (pct / 100) * (HUE_FROM - HUE_TO));
  const style = {
    width: `${pct}%`,
    ["--fill-hue" as string]: String(hue),
  } as CSSProperties;
  return (
    <span
      aria-hidden
      className="progress-fill absolute inset-y-0 left-0"
      style={style}
    />
  );
}
