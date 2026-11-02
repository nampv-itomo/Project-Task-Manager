import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MESSAGE_CHARS,
  buildCompletedMessage,
  buildDoneMessages,
} from "../src/lib/watch/format.ts";

test("buildDoneMessages formats one spec exactly as the spec sample", () => {
  const messages = buildDoneMessages(
    "ProjA",
    { total: 20, done: 12, pending: 8 },
    [{ slug: "spec-01-us1", taskIds: ["T014", "T015"] }],
  );
  assert.deepEqual(messages, ["ProjA · 12/20 task\n• spec-01-us1: T014, T015"]);
});

test("buildDoneMessages bundles several specs into a single message", () => {
  const messages = buildDoneMessages(
    "ProjA",
    { total: 20, done: 12, pending: 8 },
    [
      { slug: "spec-01-us1", taskIds: ["T014", "T015"] },
      { slug: "spec-03-us2", taskIds: ["T021"] },
    ],
  );
  assert.equal(messages.length, 1);
  assert.equal(
    messages[0],
    "ProjA · 12/20 task\n• spec-01-us1: T014, T015\n• spec-03-us2: T021",
  );
});

test("buildDoneMessages returns nothing when no spec has newly done tasks", () => {
  assert.deepEqual(
    buildDoneMessages("ProjA", { total: 3, done: 3, pending: 0 }, []),
    [],
  );
  assert.deepEqual(
    buildDoneMessages("ProjA", { total: 3, done: 3, pending: 0 }, [
      { slug: "spec-01", taskIds: [] },
    ]),
    [],
  );
});

test("buildDoneMessages repeats the project header on every split message", () => {
  const deltas = Array.from({ length: 60 }, (_unused, i) => ({
    slug: `spec-${String(i).padStart(3, "0")}-with-a-quite-long-slug-name`,
    taskIds: [`T${i}01`, `T${i}02`, `T${i}03`],
  }));
  const messages = buildDoneMessages(
    "ProjA",
    { total: 500, done: 300, pending: 200 },
    deltas,
  );
  assert.ok(messages.length > 1, "expected the message to be split");
  for (const message of messages) {
    assert.ok(message.length <= MAX_MESSAGE_CHARS, `message too long: ${message.length}`);
    assert.ok(message.startsWith("ProjA · 300/500 task"));
  }
});

test("buildDoneMessages splits one huge spec without cutting a task id", () => {
  const ids = Array.from({ length: 600 }, (_unused, i) => `T${String(i).padStart(4, "0")}`);
  const messages = buildDoneMessages(
    "ProjA",
    { total: 600, done: 600, pending: 0 },
    [{ slug: "spec-huge", taskIds: ids }],
  );
  assert.ok(messages.length > 1);
  for (const message of messages) {
    assert.ok(message.length <= MAX_MESSAGE_CHARS, `message too long: ${message.length}`);
  }
  const reported = messages.join("\n").match(/T\d{4}/g) ?? [];
  assert.equal(reported.length, ids.length);
});

test("buildCompletedMessage marks the spec as finished", () => {
  assert.equal(
    buildCompletedMessage("ProjA", "spec-01-us1", 20),
    "✅ ProjA / spec-01-us1 — 20/20 task, spec hoàn thành",
  );
});
