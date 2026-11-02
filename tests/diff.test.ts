import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, isSpecCompleted } from "../src/lib/watch/diff.ts";

test("diffSnapshots reports a newly completed task", () => {
  const diff = diffSnapshots(["T001", "T002"], ["T001", "T002", "T003"]);
  assert.deepEqual(diff.newlyDone, ["T003"]);
  assert.deepEqual(diff.reopened, []);
});

test("diffSnapshots reports reopened tasks and no newlyDone", () => {
  const diff = diffSnapshots(["T001", "T002"], ["T001"]);
  assert.deepEqual(diff.newlyDone, []);
  assert.deepEqual(diff.reopened, ["T002"]);
});

test("diffSnapshots reports both directions in one pass", () => {
  const diff = diffSnapshots(["T001", "T002"], ["T001", "T003"]);
  assert.deepEqual(diff.newlyDone, ["T003"]);
  assert.deepEqual(diff.reopened, ["T002"]);
});

test("diffSnapshots reports nothing when both snapshots are empty", () => {
  const diff = diffSnapshots([], []);
  assert.deepEqual(diff.newlyDone, []);
  assert.deepEqual(diff.reopened, []);
});

test("diffSnapshots ignores reordering of the same task ids", () => {
  const diff = diffSnapshots(["T003", "T001", "T002"], ["T001", "T002", "T003"]);
  assert.deepEqual(diff.newlyDone, []);
  assert.deepEqual(diff.reopened, []);
});

test("diffSnapshots keeps the order of the current snapshot for newlyDone", () => {
  const diff = diffSnapshots([], ["T010", "T002", "T007"]);
  assert.deepEqual(diff.newlyDone, ["T010", "T002", "T007"]);
});

test("diffSnapshots does not report a duplicate id twice", () => {
  const diff = diffSnapshots(["T001"], ["T001", "T002", "T002"]);
  assert.deepEqual(diff.newlyDone, ["T002"]);
});

test("diffSnapshots handles a spec whose tasks all disappear", () => {
  const diff = diffSnapshots(["T001", "T002"], []);
  assert.deepEqual(diff.newlyDone, []);
  assert.deepEqual(diff.reopened, ["T001", "T002"]);
});

test("isSpecCompleted is true only when pending drops to zero on a spec that had pending", () => {
  assert.equal(isSpecCompleted({ total: 5, done: 4, pending: 1 }, { total: 5, done: 5, pending: 0 }), true);
});

test("isSpecCompleted is false while tasks are still pending", () => {
  assert.equal(isSpecCompleted({ total: 5, done: 1, pending: 4 }, { total: 5, done: 3, pending: 2 }), false);
});

test("isSpecCompleted is false for a spec that was already complete", () => {
  assert.equal(isSpecCompleted({ total: 5, done: 5, pending: 0 }, { total: 5, done: 5, pending: 0 }), false);
});

test("isSpecCompleted is false for a spec with no tasks at all", () => {
  assert.equal(isSpecCompleted({ total: 0, done: 0, pending: 0 }, { total: 0, done: 0, pending: 0 }), false);
});
