import { test } from "node:test";
import assert from "node:assert/strict";

const { formatWatchTime } = await import("../src/lib/watch/time.ts");

test("SQLite UTC timestamps are rendered in UTC+7", () => {
  assert.equal(formatWatchTime("2026-11-02 08:00:32"), "15:00 02/11");
  assert.equal(formatWatchTime("2026-11-02 08:00:00"), "15:00 02/11");
  assert.equal(formatWatchTime("2026-01-31 17:30:05"), "00:30 01/02");
});

test("ISO timestamps (start.ts) are rendered the same way", () => {
  assert.equal(formatWatchTime("2026-11-02T08:00:32.000Z"), "15:00 02/11");
});

test("no timestamp is a visible dash, not a blank", () => {
  assert.equal(formatWatchTime(null), "—");
  assert.equal(formatWatchTime(""), "—");
});

test("a broken timestamp is labelled instead of crashing the page", () => {
  assert.equal(formatWatchTime("khong phai thoi gian"), "—");
});

test("the full value is available for a title attribute", () => {
  assert.equal(formatWatchTime("2026-11-02 08:00:32", { iso: true }), "2026-11-02 08:00:32");
  assert.equal(formatWatchTime(null, { iso: true }), "");
});
