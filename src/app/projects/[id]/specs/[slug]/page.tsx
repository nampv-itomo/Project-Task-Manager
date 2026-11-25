import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { computeStats, getSpec, listSpecs } from "@/lib/specs";
import { getSnapshot } from "@/lib/watch/store";
import { watchStatus } from "@/lib/watch/start";
import { AutoCheckLine } from "@/components/watch-status";
import { RowProgress, StatsBadges } from "@/components/progress";
import { RefreshButton } from "@/components/refresh-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { SpecFilterTabs } from "@/components/spec-filter-tabs";
import { Badge } from "@astryxdesign/core/Badge";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { Button } from "@astryxdesign/core/Button";
import { LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { SpecSwitcher } from "@/components/spec-switcher";
import { Layout } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chưa xong" },
  { key: "done", label: "Đã xong" },
] as const;

/**
 * One spec's tasks. `AppRefresh`-driven: `<AutoRefresh>` polls `router.refresh()`
 * on the watch job's interval so the phase list follows each tick.
 *
 * Phases are an Astryx `CollapsibleGroup` (`type="multiple"`, hairline dividers,
 * `defaultValue={[]}` = every phase closed, the old `<details>` default). The
 * open/closed state lives inside `Collapsible`/`CollapsibleGroup`'s own client
 * boundary — the page itself stays a Server Component (Astryx components carry
 * their own `"use client"`, so children come down as an RSC payload) and a
 * `router.refresh()` reconciles the same tree position, so an expanded phase
 * stays expanded. Note rows keep their own uncontrolled `Collapsible` (no
 * `value` → not group-coordinated, per `useCollapsible`).
 *
 * `Layout`'s `start` slot carries a 200px `LayoutPanel` listing the project's
 * other specs, so switching spec is one click on a plain `<Link>` URL — no trip
 * back through `/projects/[id]`. The current spec is the `isSelected` row.
 *
 * The top block (breadcrumbs, title row, stats, auto-check line, filter tabs)
 * lives in `Layout`'s `header` slot so it keeps spanning the **full** content
 * width, while `start` now sits in the row *below* the header — i.e. opposite
 * the phase list only, not running up alongside the title.
 */
export default async function SpecPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/specs/[slug]">) {
  const { id, slug: rawSlug } = await params;
  const { status } = await searchParams;
  const slug = decodeURIComponent(rawSlug);
  const project = Number.isInteger(Number(id))
    ? getProject(Number(id))
    : undefined;
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
  const specs = listSpecs(project.path);

  const phases = spec.phases
    .map((phase) => ({
      phase,
      stats: computeStats(phase.tasks),
      tasks: phase.tasks.filter(
        (t) => filter === "all" || (filter === "done") === t.done,
      ),
    }))
    .filter((p) => p.tasks.length > 0);

  const topBlock = (
    <Stack gap={4}>
      <Breadcrumbs variant="supporting">
        <BreadcrumbItem href="/">Tổng quan</BreadcrumbItem>
        <BreadcrumbItem href="/projects">Dự án</BreadcrumbItem>
        <BreadcrumbItem href={`/projects/${project.id}`}>
          {project.name}
        </BreadcrumbItem>
        <BreadcrumbItem isCurrent>{slug}</BreadcrumbItem>
      </Breadcrumbs>

      <HStack gap={3} hAlign="between" align="center">
        <HStack gap={2} align="center">
          {/* Back to the project's spec list. An `href` Button, not
             `router.back()`: it renders through `LinkProvider` → Next `<Link>`,
             so it is a plain URL navigation the server re-renders, and it
             always lands on `/projects/[id]` no matter where the user came
             from. `chevronLeft` is an Astryx semantic icon (no `icons.tsx`
             wrapper needed). */}
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon icon="chevronLeft" />}
            label="Back"
            tooltip="Quay lại danh sách Specs"
            href={`/projects/${project.id}`}
          />
          {/* `font-mono` is a **token-backed** Tailwind utility here:
             `core/tailwind-theme.css` maps `--font-mono` → `--font-family-code`,
             so this is the Astryx code font, not a raw font stack. Astryx has no
             mono variant on `Heading`, and nesting `Text type="code"` would
             re-size the h1 through `Text`'s own type scale. */}
          <Heading level={1} className="font-mono">
            {slug}
          </Heading>
        </HStack>
        <RefreshButton />
      </HStack>
      <AutoRefresh intervalMs={job.intervalMs} enabled={job.enabled} />

      {spec.hasTasks && (
        <>
          <Stack gap={4}>
            <StatsBadges stats={stats} />
            <AutoCheckLine
              summary={watchSummary}
              enabled={job.enabled}
              intervalMs={job.intervalMs}
              heading="Auto-check cho spec này"
              autoRefreshing
            />
          </Stack>
          <SpecFilterTabs value={filter} base={base} options={[...FILTERS]} />
        </>
      )}
    </Stack>
  );

  return (
    <Layout
      // No `contentWidth`: `/projects/[id]` (the spec list) leaves the aligned
      // width unset too, so both pages let their content span the full
      // `<main>` minus `LayoutContent`/`LayoutHeader`'s own `padding={4}`.
      // A capped width here used to centre the page and push the phase list
      // inward on wide screens, which read as a different left/right gutter
      // from the spec list.
      // `header` spans the **whole** row above the start/content split, so the
      // top block keeps its old full-width span while `start` (the spec list)
      // now lines up only with the phase accordion below it.
      header={<LayoutHeader padding={4}>{topBlock}</LayoutHeader>}
      content={
        <LayoutContent padding={4}>
          {!spec.hasTasks ? (
            <EmptyState
              headingLevel={2}
              title="Spec này chưa có tasks.md"
              description="Chạy tasks của Spec Kit trong thư mục dự án để sinh tasks.md, rồi làm mới trang."
            />
          ) : (
            <>
              {phases.length === 0 && (
                <EmptyState
                  isCompact
                  headingLevel={3}
                  title="Không có task nào khớp bộ lọc"
                  actions={
                    <Button
                      label="Xem tất cả task"
                      href={base}
                      variant="secondary"
                    />
                  }
                />
              )}

              <CollapsibleGroup
                // Accordion for the phases: many open at once, hairline dividers,
                // `defaultValue={[]}` keeps every phase collapsed on load (the old
                // `<details>` default). The wrapper renders no box of its own
                // beyond the divider lines — no `border-*`/`bg-*` classes any more.
                type="multiple"
                hasDividers
                density="compact"
                defaultValue={[]}
              >
                {phases.map(({ phase, stats, tasks }) => (
                  <Collapsible
                    key={phase.title}
                    value={phase.title}
                    trigger={
                      // The badge always counts the phase's **full** task set (never
                      // the filtered subset) while the fill/width keeps encoding
                      // completed %; under the "Chưa xong" filter the label reads
                      // pending/total, which is the complement of the bar.
                      <Stack gap={1} width="100%">
                        <HStack gap={2} hAlign="between" align="center">
                          <Text weight="semibold">{phase.title}</Text>
                          <Badge
                            label={
                              filter === "pending"
                                ? `${stats.pending}/${stats.total}`
                                : `${stats.done}/${stats.total}`
                            }
                            variant={
                              stats.done === stats.total ? "success" : "neutral"
                            }
                          />
                        </HStack>
                        <RowProgress stats={stats} />
                      </Stack>
                    }
                  >
                    <List density="compact" edge="outset" hasDividers>
                      {tasks.map((t) => (
                        <ListItem
                          key={t.id}
                          align="start"
                          startContent={
                            <Icon
                              icon={t.done ? "check" : "clock"}
                              color={t.done ? "success" : "tertiary"}
                              label={t.done ? "Đã xong" : "Chưa xong"}
                            />
                          }
                          label={
                            <HStack gap={2} align="center" wrap="wrap">
                              <Text type="code" size="2xs" weight="medium">
                                {t.id}
                              </Text>
                              {t.tags.map((tag) => (
                                <Badge key={tag} label={tag} />
                              ))}
                              <Text
                                color={t.done ? "secondary" : "primary"}
                                hasStrikethrough={t.done}
                                wordBreak="break-word"
                              >
                                {t.title}
                              </Text>
                            </HStack>
                          }
                          description={
                            t.notes.length > 0 ? (
                              // Deliberately **no `value`**: `useCollapsible` only
                              // defers to the group when the item has one, so this
                              // row keeps its own open state instead of joining the
                              // phase accordion.
                              <Collapsible
                                defaultIsOpen={false}
                                trigger={
                                  <Text type="supporting" color="secondary">
                                    Ghi chú ({t.notes.length})
                                  </Text>
                                }
                              >
                                <Stack gap={1} padding={2}>
                                  {t.notes.map((n, i) => (
                                    <Text
                                      key={i}
                                      type="supporting"
                                      color="secondary"
                                      wordBreak="break-word"
                                    >
                                      {n}
                                    </Text>
                                  ))}
                                </Stack>
                              </Collapsible>
                            ) : undefined
                          }
                        />
                      ))}
                    </List>
                  </Collapsible>
                ))}
              </CollapsibleGroup>
            </>
          )}
        </LayoutContent>
      }
      start={
        spec.hasTasks && (
          <SpecSwitcher
            projectId={project.id}
            projectName={project.name}
            currentSlug={slug}
            specs={specs}
          />
        )
      }
    />
  );
}
