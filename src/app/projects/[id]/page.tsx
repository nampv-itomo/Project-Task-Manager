import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { projectSnapshots, recentNotifications } from "@/lib/watch/store";
import { watchStatus } from "@/lib/watch/start";
import { AutoCheckLine, NotificationLog } from "@/components/watch-status";
import { CountBadge, RowProgress, StatsBadges } from "@/components/progress";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import {
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

/** spec_watch stores "YYYY-MM-DD HH:MM:SS" UTC, so plain string max is correct. */
function latest(values: (string | null)[]): string | null {
  return values.reduce<string | null>(
    (max, value) => (value && value > (max ?? "") ? value : max),
    null,
  );
}

/**
 * Project dashboard: `AppShell`'s `height="fill"` already gives `<main>` the
 * viewport height, so `Layout height="fill"` + a scrolling `LayoutContent` + a
 * scrolling `LayoutPanel` reproduce the old fixed-height two-column board
 * without the hand-rolled `--content-h` measurement in `globals.css`.
 * Specs are the only progress source (`listSpecs`), as on every other screen.
 */
export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
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
    <Layout
      height="fill"
      header={
        <LayoutHeader padding={4} hasDivider>
          <Stack gap={2}>
            <Breadcrumbs variant="supporting">
              <BreadcrumbItem href="/">Tổng quan</BreadcrumbItem>
              <BreadcrumbItem href="/projects">Dự án</BreadcrumbItem>
              <BreadcrumbItem isCurrent>{project.name}</BreadcrumbItem>
            </Breadcrumbs>
            <Stack gap={1}>
              <Heading level={1}>{project.name}</Heading>
              <Text type="code" size="2xs" color="secondary" maxLines={1}>
                {project.path}
              </Text>
            </Stack>
            <StatsBadges stats={total} />
          </Stack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4} label="Danh sách spec">
          {specs.length === 0 ? (
            <EmptyState
              isCompact
              headingLevel={3}
              title="Không có spec nào"
              description="Không tìm thấy thư mục specs/ hoặc thư mục trống."
            />
          ) : (
            <List
              hasDividers
              density="compact"
              header={<Heading level={2}>Specs ({specs.length})</Heading>}
            >
              {specs.map((s) => (
                <ListItem
                  key={s.slug}
                  href={`/projects/${project.id}/specs/${encodeURIComponent(s.slug)}`}
                  label={
                    <Text type="code" weight="medium" maxLines={1}>
                      {s.slug}
                    </Text>
                  }
                  // Progress lives on the row's second line, and the `done/total`
                  // pill on the right stays the readable channel (the bar is
                  // `isLabelHidden`, so width + text carry the value together).
                  // `CountBadge` is a fixed-width column on purpose: a
                  // `fit-content` pill would make each row's label column — and
                  // so each `width: 100%` bar — as wide as its own number,
                  // drawing a `5/5` bar longer than a `100/100` one.
                  description={<RowProgress stats={s.stats} />}
                  endContent={<CountBadge stats={s.stats} hasTasks={s.hasTasks} />}
                />
              ))}
            </List>
          )}
        </LayoutContent>
      }
      end={
        <LayoutPanel width={380} hasDivider padding={4} label="Auto-check và thông báo">
          <Stack gap={6}>
            <AutoCheckLine summary={summary} enabled={job.enabled} intervalMs={job.intervalMs} />
            <NotificationLog rows={notifications} />
          </Stack>
        </LayoutPanel>
      }
    />
  );
}
