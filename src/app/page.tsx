import fs from "node:fs";
import { listProjects } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { CountBadge, RowProgress, StatsBadges } from "@/components/progress";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { PlusIcon } from "@/components/icons";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = listProjects().map((p) => {
    const specs = listSpecs(p.path);
    return {
      ...p,
      exists: fs.existsSync(p.path),
      specCount: specs.length,
      stats: sumStats(specs.map((s) => s.stats)),
    };
  });

  const total = sumStats(projects.map((p) => p.stats));
  const specCount = projects.reduce((n, p) => n + p.specCount, 0);
  const pct = total.total ? Math.round((total.done / total.total) * 100) : 0;

  const kpis = [
    { label: "Dự án", value: projects.length },
    { label: "Spec", value: specCount },
    { label: "Task đã xong", value: total.done },
    { label: "Task chưa xong", value: total.pending },
  ];

  return (
    <Layout padding={4} contentWidth={960}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Tổng quan</Heading>
          <Text color="secondary">Tiến độ task (Spec Kit) trên tất cả dự án.</Text>
        </Stack>

        {projects.length === 0 ? (
          <EmptyState
            headingLevel={2}
            title="Chưa có dự án nào"
            description="Thêm một dự án local (thư mục có specs/) để bắt đầu theo dõi tiến độ."
            actions={<Button label="Thêm dự án" href="/projects" variant="primary" icon={<PlusIcon />} />}
          />
        ) : (
          <>
            <Stack gap={3}>
              <Heading level={2}>Toàn cục — {pct}% hoàn thành</Heading>
              <Grid columns={{ minWidth: 180, max: 4 }} gap={3}>
                {kpis.map((k) => (
                  <Card key={k.label} padding={3}>
                    <Stack gap={0.5}>
                      <Text size="2xl" weight="semibold" hasTabularNumbers>
                        {k.value}
                      </Text>
                      <Text type="supporting" color="secondary">
                        {k.label}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Grid>
              <StatsBadges stats={total} />
            </Stack>

            <List
              hasDividers
              density="compact"
              header={<Heading level={2}>Tiến độ từng dự án</Heading>}
            >
              {projects.map((p) => (
                <ListItem
                  key={p.id}
                  href={`/projects/${p.id}`}
                  description={<RowProgress stats={p.stats} />}
                  endContent={
                    !p.exists ? (
                      // Status text, not a count — it must stay readable, so it
                      // keeps Badge's fit-content and is the one row whose bar
                      // column is a different width (its track is empty at 0/0).
                      <Badge variant="error" label="Không tìm thấy thư mục" />
                    ) : p.specCount === 0 ? (
                      <Badge label="Chưa có specs/" />
                    ) : (
                      <CountBadge stats={p.stats} />
                    )
                  }
                  label={p.name}
                />
              ))}
            </List>
          </>
        )}
      </Stack>
    </Layout>
  );
}
