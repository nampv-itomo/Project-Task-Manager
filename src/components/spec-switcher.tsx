import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { LayoutPanel } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { SpecSummary } from "@/lib/specs";

export type SpecSwitcherProps = {
  projectId: number;
  projectName: string;
  /** Slug của spec đang xem — row này là `isSelected` (`aria-current="true"`). */
  currentSlug: string;
  /** `listSpecs()` của cùng project, giữ nguyên thứ tự. */
  specs: SpecSummary[];
};

/**
 * Left-hand sibling-spec switcher for `/projects/[id]/specs/[slug]`: a 200px
 * `LayoutPanel` sitting in `Layout`'s `start` slot, listing every spec của
 * project. Switching spec là một click trên `href` row → `LinkProvider`'s
 * `<Link>` — plain URL navigation, deep-linkable, survives Back — nên người
 * dùng không phải back ra `/projects/[id]`.
 *
 * Names only, no `CountBadge`: `progress.tsx`'s pill is a fixed 5rem column and
 * a 200px panel cannot spare it without collapsing the slug to an ellipsis.
 * Progress still lives on `/projects/[id]` and in this spec's own phase list.
 *
 * **No `Heading` inside**: `Layout` renders the `start` slot before the page's
 * `h1` in DOM order, so an h2/h3 here would read as the page's outline to a
 * screen reader; weighted `Text` labels name the group instead. `role` +
 * `label` make it a second navigation landmark beside `AppNav`'s.
 *
 * Stays a Server Component: only serializable props, no fetching of its own —
 * the route already read `listSpecs()`.
 */
export function SpecSwitcher({
  projectId,
  projectName,
  currentSlug,
  specs,
}: SpecSwitcherProps) {
  return (
    <LayoutPanel
      width={200}
      hasDivider
      padding={3}
      isScrollable
      role="navigation"
      label="Danh sách spec của dự án"
    >
      <Stack gap={3}>
        <HStack gap={2} align="center">
          <Text weight="semibold" maxLines={1}>
            {projectName}
          </Text>
          <Badge label={`${specs.length}`} />
        </HStack>
        {specs.length === 0 ? (
          <Text type="supporting" color="secondary">
            Chưa có spec nào
          </Text>
        ) : (
          <List
            density="compact"
            hasDividers
            header={
              <Text type="supporting" color="secondary" weight="medium">
                Specs
              </Text>
            }
          >
            {specs.map((s) => (
              <ListItem
                key={s.slug}
                href={`/projects/${projectId}/specs/${encodeURIComponent(s.slug)}`}
                // The row the user is already on: `isSelected` →
                // `aria-current="true"`, so the list doubles as a location map.
                isSelected={s.slug === currentSlug}
                label={
                  <Text type="code" size="sm" weight="semibold" maxLines={1}>
                    {s.slug}
                  </Text>
                }
              />
            ))}
          </List>
        )}
      </Stack>
    </LayoutPanel>
  );
}
