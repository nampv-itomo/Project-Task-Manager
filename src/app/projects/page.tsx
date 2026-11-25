import fs from "node:fs";
import { listProjects } from "@/lib/db";
import { listSpecs, sumStats } from "@/lib/specs";
import { AddProjectForm } from "@/components/add-project-form";
import { RemoveProjectButton } from "@/components/remove-project-button";
import { RowProgress } from "@/components/progress";
import { Badge } from "@astryxdesign/core/Badge";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const projects = listProjects().map((p) => {
    const specs = listSpecs(p.path);
    return {
      ...p,
      exists: fs.existsSync(p.path),
      specCount: specs.length,
      stats: sumStats(specs.map((s) => s.stats)),
    };
  });

  return (
    <Layout padding={4} contentWidth={960}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Dự án</Heading>
          <Text color="secondary">
            Danh sách dự án trên máy này (mỗi dự án đọc từ thư mục specs/).
          </Text>
        </Stack>

        <Stack gap={2}>
          <Heading level={2}>Thêm dự án</Heading>
          <AddProjectForm />
        </Stack>
        {projects.length === 0 ? (
          <EmptyState
            isCompact
            headingLevel={3}
            title="Chưa có dự án nào"
            description="Thêm đường dẫn ở trên để bắt đầu."
          />
        ) : (
          <List
            hasDividers
            density="compact"
            header={<Heading level={2}>Dự án ({projects.length})</Heading>}
          >
            {projects.map((p) => (
              <ListItem
                key={p.id}
                // The row stays non-interactive on purpose: `endContent` holds a
                // real control (`RemoveProjectButton`) and `List` forbids an
                // interactive element inside an interactive row. The name is the
                // link; `Gỡ` is a second, separate affordance.
                label={<Link href={`/projects/${p.id}`}>{p.name}</Link>}
                description={
                  <Stack gap={1}>
                    {/* Truncated path gets Astryx's own truncation tooltip, so the
                        old `title={p.path}` attribute is no longer needed. `size="sm"`
                        (was `2xs`): the path is the row's locator, so it reads at
                        body size rather than as a footnote. */}
                    <Text type="code" size="sm" color="secondary" maxLines={1}>
                      {p.path}
                    </Text>
                    {!p.exists ? (
                      <Badge variant="error" label="Không tìm thấy thư mục" />
                    ) : p.specCount === 0 ? (
                      <Text type="supporting" color="secondary">
                        Chưa có thư mục specs/.
                      </Text>
                    ) : (
                      <Stack gap={1}>
                        {/* Same bump as the path line: spec/task counts are read
                            across rows, so they no longer sit at `2xs`. */}
                        <Text size="sm" color="secondary" hasTabularNumbers>
                          {p.specCount} spec · {p.stats.done}/{p.stats.total} task
                        </Text>
                        <RowProgress stats={p.stats} />
                      </Stack>
                    )}
                  </Stack>
                }
                endContent={<RemoveProjectButton id={p.id} name={p.name} />}
              />
            ))}
          </List>
        )}
      </Stack>
    </Layout>
  );
}
