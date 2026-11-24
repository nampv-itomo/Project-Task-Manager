"use client";

import Link from "next/link";
import { Tab, TabList } from "@astryxdesign/core/TabList";

/**
 * Status filter for one spec's task list: a strip of **anchor** tabs, so
 * choosing a filter is still a plain URL navigation (`?status=pending`) that
 * deep-links and survives the Back button — the page stays server-rendered and
 * the data is re-read on the server.
 *
 * Two details that look wrong but are deliberate:
 * - `role` is left unset. The default strip is a nav landmark that marks the
 *   current tab with `aria-current`, and that is the only mode where `href`
 *   works. Setting `role="tablist"` switches to the WAI-ARIA tabs pattern, where
 *   `href` is *ignored* and panels would have to live in this page's state.
 * - `onChange` does nothing. `TabList` is interactive, so it must sit inside a
 *   Client Component (a Server Component cannot pass its `onChange` across the
 *   boundary); the client half takes only serializable props (`value`, `base`,
 *   `options`) and lets the tabs navigate by `href`. `onChange` exists solely to
 *   keep the strip keyboard-navigable without hijacking the link.
 */
export function SpecFilterTabs({
  value,
  base,
  options,
}: {
  value: string;
  base: string;
  options: { key: string; label: string }[];
}) {
  return (
    <TabList value={value} onChange={() => {}}>
      {options.map((f) => (
        <Tab
          key={f.key}
          value={f.key}
          label={f.label}
          as={Link}
          href={f.key === "all" ? base : `${base}?status=${f.key}`}
        />
      ))}
    </TabList>
  );
}
