import { test } from "node:test";
import assert from "node:assert/strict";

const { startWatch, stopWatch, watchIntervalMs, watchEnabled, watchStatus } = await import(
  "../src/lib/watch/start.ts"
);

function cleanEnv() {
  delete process.env.TASK_WATCH_ENABLED;
  delete process.env.TASK_WATCH_INTERVAL_MS;
  delete process.env.NEXT_RUNTIME;
  stopWatch();
}

test("the interval defaults to 60 seconds", () => {
  cleanEnv();
  assert.equal(watchIntervalMs(), 60_000);
  process.env.TASK_WATCH_INTERVAL_MS = "15000";
  assert.equal(watchIntervalMs(), 15_000);
});

test("a broken or unsafe interval falls back to 60 seconds", () => {
  cleanEnv();
  for (const value of ["abc", "", "-5", "0", "300"]) {
    process.env.TASK_WATCH_INTERVAL_MS = value;
    assert.equal(watchIntervalMs(), 60_000, `value ${JSON.stringify(value)}`);
  }
});

test("the watch is enabled unless it is switched off", () => {
  cleanEnv();
  assert.equal(watchEnabled(), true);
  process.env.TASK_WATCH_ENABLED = "0";
  assert.equal(watchEnabled(), false);
});

test("startWatch does nothing outside the Node runtime", () => {
  cleanEnv();
  process.env.NEXT_RUNTIME = "edge";
  let ticks = 0;
  const started = startWatch({
    tick: async () => {
      ticks += 1;
    },
    intervalMs: 20,
  });
  assert.equal(started, false);
  assert.equal(ticks, 0);
  assert.equal(watchStatus().running, false);
});

test("startWatch respects TASK_WATCH_ENABLED=0", () => {
  cleanEnv();
  process.env.NEXT_RUNTIME = "nodejs";
  process.env.TASK_WATCH_ENABLED = "0";
  assert.equal(
    startWatch({
      tick: async () => {
        throw new Error("must not run");
      },
      intervalMs: 20,
    }),
    false,
  );
});

test("a second startWatch call never starts a second interval", () => {
  cleanEnv();
  process.env.NEXT_RUNTIME = "nodejs";
  process.env.TASK_WATCH_INTERVAL_MS = "5000";
  try {
    assert.equal(startWatch({ tick: async () => {} }), true);
    assert.equal(startWatch({ tick: async () => {} }), false);
    const status = watchStatus();
    assert.equal(status.running, true);
    assert.equal(status.intervalMs, 5_000);
    assert.ok(status.startedAt);
  } finally {
    stopWatch();
  }
  assert.equal(watchStatus().running, false);
});

test("the interval runs the tick repeatedly and stopWatch stops it", async () => {
  cleanEnv();
  process.env.NEXT_RUNTIME = "nodejs";
  process.env.TASK_WATCH_INTERVAL_MS = "20";
  let ticks = 0;
  try {
    startWatch({
      tick: async () => {
        ticks += 1;
      },
      intervalMs: 20,
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.ok(ticks >= 3, `ticks=${ticks}`);
  } finally {
    stopWatch();
  }
  const settled = ticks;
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(ticks, settled, "stopWatch must stop the interval");
});

test("a failing tick does not kill the interval", async () => {
  cleanEnv();
  process.env.NEXT_RUNTIME = "nodejs";
  process.env.TASK_WATCH_INTERVAL_MS = "20";
  let ticks = 0;
  try {
    startWatch({
      tick: async () => {
        ticks += 1;
        if (ticks === 1) throw new Error("boom");
      },
      intervalMs: 20,
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.ok(ticks >= 2, `ticks=${ticks}`);
  } finally {
    stopWatch();
  }
});
