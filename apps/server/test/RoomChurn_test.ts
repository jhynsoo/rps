import assert from "node:assert";
import { boot, type ColyseusTestServer } from "@colyseus/testing";

import appConfig from "../src/app.config";
import { type RuntimeStatsSnapshot, snapshot } from "../src/observability/runtimeStats";
import type { MyRoomState } from "../src/rooms/schema/MyRoomState";

function readIntEnv(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer between ${bounds.min} and ${bounds.max}`);
  }

  if (parsed < bounds.min || parsed > bounds.max) {
    throw new Error(`${name} must be an integer between ${bounds.min} and ${bounds.max}`);
  }

  return parsed;
}

function readFloatEnv(
  name: string,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new Error(`${name} must be a number between ${bounds.min} and ${bounds.max}`);
  }

  if (parsed < bounds.min || parsed > bounds.max) {
    throw new Error(`${name} must be a number between ${bounds.min} and ${bounds.max}`);
  }

  return parsed;
}

const TEST_TIMEOUT_MS = readIntEnv("RPS_CHURN_TEST_TIMEOUT_MS", 90000, {
  min: 10000,
  max: 300000,
});
const NORMAL_CYCLES = readIntEnv("RPS_CHURN_NORMAL_CYCLES", 8, {
  min: 1,
  max: 80,
});
const ABRUPT_RESULT_CYCLES = readIntEnv("RPS_CHURN_ABRUPT_RESULT_CYCLES", 6, {
  min: 1,
  max: 80,
});
const ABRUPT_CHOOSING_CYCLES = readIntEnv("RPS_CHURN_ABRUPT_CHOOSING_CYCLES", 6, {
  min: 1,
  max: 80,
});
const CONVERGENCE_TIMEOUT_MS = readIntEnv("RPS_CHURN_CONVERGENCE_TIMEOUT_MS", 12000, {
  min: 2000,
  max: 120000,
});
const CONVERGENCE_POLL_MS = readIntEnv("RPS_CHURN_CONVERGENCE_POLL_MS", 100, {
  min: 25,
  max: 2000,
});
const CONVERGENCE_COOLDOWN_MS = readIntEnv("RPS_CHURN_CONVERGENCE_COOLDOWN_MS", 1400, {
  min: 500,
  max: 10000,
});
const MAX_HEAP_DELTA_BYTES = readIntEnv("RPS_CHURN_MAX_HEAP_DELTA_BYTES", 48 * 1024 * 1024, {
  min: 1024 * 1024,
  max: 1024 * 1024 * 1024,
});
const MAX_RSS_DELTA_BYTES = readIntEnv("RPS_CHURN_MAX_RSS_DELTA_BYTES", 96 * 1024 * 1024, {
  min: 1024 * 1024,
  max: 2 * 1024 * 1024 * 1024,
});
const MAX_HANDLE_DELTA = readIntEnv("RPS_CHURN_MAX_HANDLE_DELTA", 10, {
  min: 1,
  max: 200,
});
const MAX_HEAP_RATIO = readFloatEnv("RPS_CHURN_MAX_HEAP_RATIO", 2.5, {
  min: 1,
  max: 20,
});
const MAX_RSS_RATIO = readFloatEnv("RPS_CHURN_MAX_RSS_RATIO", 1.8, {
  min: 1,
  max: 20,
});
const MAX_HANDLE_RATIO = readFloatEnv("RPS_CHURN_MAX_HANDLE_RATIO", 1.8, {
  min: 1,
  max: 20,
});

const SNAPSHOT_OPTIONS = {
  includeMemory: true,
  includeHandleCount: true,
} as const;

type RoomWithState = {
  state: MyRoomState;
  waitForNextPatch: () => Promise<void>;
};

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function takeStats(): RuntimeStatsSnapshot {
  return snapshot(SNAPSHOT_OPTIONS);
}

async function waitForGameStatus(
  room: RoomWithState,
  expectedStatus: string,
  maxPatches = 10,
): Promise<void> {
  for (let attempt = 0; attempt < maxPatches; attempt += 1) {
    if (room.state.gameStatus === expectedStatus) {
      return;
    }

    await room.waitForNextPatch();
  }

  assert.fail(`Expected gameStatus '${expectedStatus}', received '${room.state.gameStatus}'`);
}

function isLifecycleConverged(stats: RuntimeStatsSnapshot): boolean {
  return (
    stats.roomsCreated === stats.roomsDisposed &&
    stats.activeRooms === 0 &&
    stats.activeClients === 0
  );
}

async function waitForLifecycleConvergence(label: string): Promise<RuntimeStatsSnapshot> {
  await delay(CONVERGENCE_COOLDOWN_MS);

  const deadline = Date.now() + CONVERGENCE_TIMEOUT_MS;
  let latest = takeStats();

  while (Date.now() <= deadline) {
    latest = takeStats();

    if (isLifecycleConverged(latest)) {
      return latest;
    }

    await delay(CONVERGENCE_POLL_MS);
  }

  assert.fail(
    `${label} did not converge within ${CONVERGENCE_TIMEOUT_MS}ms: ${JSON.stringify(latest)}`,
  );
}

async function runCooldownAudit(
  scenario: string,
  baseline: RuntimeStatsSnapshot,
  postConvergence: RuntimeStatsSnapshot,
): Promise<void> {
  const cooldownStart = postConvergence;
  await delay(CONVERGENCE_COOLDOWN_MS);
  const cooldownEnd = takeStats();

  assert.ok(baseline.handles, `${scenario}: baseline handle snapshot is missing`);
  assert.ok(cooldownStart.handles, `${scenario}: cooldown start handle snapshot is missing`);
  assert.ok(cooldownEnd.handles, `${scenario}: cooldown end handle snapshot is missing`);

  assert.strictEqual(
    cooldownEnd.roomsCreated,
    cooldownStart.roomsCreated,
    `${scenario}: roomsCreated changed during cooldown window`,
  );
  assert.strictEqual(
    cooldownEnd.roomsDisposed,
    cooldownStart.roomsDisposed,
    `${scenario}: roomsDisposed changed during cooldown window`,
  );
  assert.strictEqual(
    cooldownEnd.activeRooms,
    baseline.activeRooms,
    `${scenario}: activeRooms did not return to baseline during cooldown`,
  );
  assert.strictEqual(
    cooldownEnd.activeClients,
    baseline.activeClients,
    `${scenario}: activeClients did not return to baseline during cooldown`,
  );

  const cooldownHandleDelta =
    cooldownEnd.handles.activeHandleCount - cooldownStart.handles.activeHandleCount;
  const baselineHandleDelta =
    cooldownEnd.handles.activeHandleCount - baseline.handles.activeHandleCount;

  assert.ok(
    baselineHandleDelta <= MAX_HANDLE_DELTA,
    `${scenario}: handles grew by ${baselineHandleDelta} beyond baseline by the end of cooldown (max ${MAX_HANDLE_DELTA})`,
  );
  assert.ok(
    cooldownHandleDelta <= MAX_HANDLE_DELTA,
    `${scenario}: handles drifted by ${cooldownHandleDelta} during cooldown window (max ${MAX_HANDLE_DELTA})`,
  );

  console.log(
    `CHURN_AUDIT_PASS scenario=${scenario} ` +
      `activeRooms=${cooldownEnd.activeRooms} ` +
      `activeClients=${cooldownEnd.activeClients} ` +
      `handleDeltaBaseline=${baselineHandleDelta} ` +
      `handleDeltaCooldown=${cooldownHandleDelta} ` +
      `roomsCreated=${cooldownEnd.roomsCreated} ` +
      `roomsDisposed=${cooldownEnd.roomsDisposed}`,
  );
}

function assertLifecycleConvergence(stats: RuntimeStatsSnapshot, label: string): void {
  assert.strictEqual(
    stats.roomsCreated,
    stats.roomsDisposed,
    `${label}: roomsCreated (${stats.roomsCreated}) must equal roomsDisposed (${stats.roomsDisposed})`,
  );
  assert.strictEqual(stats.activeRooms, 0, `${label}: activeRooms must be 0`);
  assert.strictEqual(stats.activeClients, 0, `${label}: activeClients must be 0`);
}

function assertBoundedTrend(
  before: RuntimeStatsSnapshot,
  after: RuntimeStatsSnapshot,
  label: string,
): void {
  assert.ok(before.memory, `${label}: baseline memory snapshot is missing`);
  assert.ok(after.memory, `${label}: final memory snapshot is missing`);
  assert.ok(before.handles, `${label}: baseline handle snapshot is missing`);
  assert.ok(after.handles, `${label}: final handle snapshot is missing`);

  const heapDelta = after.memory.heapUsed - before.memory.heapUsed;
  const heapRatio = after.memory.heapUsed / Math.max(before.memory.heapUsed, 1);
  const rssDelta = after.memory.rss - before.memory.rss;
  const rssRatio = after.memory.rss / Math.max(before.memory.rss, 1);

  assert.ok(
    heapDelta <= MAX_HEAP_DELTA_BYTES,
    `${label}: heapUsed delta ${heapDelta} exceeds max ${MAX_HEAP_DELTA_BYTES}`,
  );
  assert.ok(
    heapRatio <= MAX_HEAP_RATIO,
    `${label}: heapUsed ratio ${heapRatio.toFixed(3)} exceeds max ${MAX_HEAP_RATIO}`,
  );
  assert.ok(
    rssDelta <= MAX_RSS_DELTA_BYTES,
    `${label}: rss delta ${rssDelta} exceeds max ${MAX_RSS_DELTA_BYTES}`,
  );
  assert.ok(
    rssRatio <= MAX_RSS_RATIO,
    `${label}: rss ratio ${rssRatio.toFixed(3)} exceeds max ${MAX_RSS_RATIO}`,
  );

  const handleBefore = before.handles.activeHandleCount;
  const handleAfter = after.handles.activeHandleCount;
  const handleDelta = handleAfter - handleBefore;
  const handleRatio = handleAfter / Math.max(handleBefore, 1);

  assert.ok(
    handleDelta <= MAX_HANDLE_DELTA,
    `${label}: handle delta ${handleDelta} exceeds max ${MAX_HANDLE_DELTA}`,
  );
  assert.ok(
    handleRatio <= MAX_HANDLE_RATIO,
    `${label}: handle ratio ${handleRatio.toFixed(3)} exceeds max ${MAX_HANDLE_RATIO}`,
  );
}

async function runNormalLeaveCycles(colyseus: ColyseusTestServer, cycles: number): Promise<void> {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    const client = await colyseus.connectTo(room, {
      nickname: `normal-${cycle}`,
    });

    await room.waitForNextPatch();
    await client.leave();
  }
}

async function runAbruptLeaveDuringResultCycles(
  colyseus: ColyseusTestServer,
  cycles: number,
): Promise<void> {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    const client1 = await colyseus.connectTo(room, {
      nickname: `abrupt-a-${cycle}`,
    });
    const client2 = await colyseus.connectTo(room, {
      nickname: `abrupt-b-${cycle}`,
    });

    await waitForGameStatus(room, "mode_select");

    client1.send("select_mode", { mode: "single" });
    await waitForGameStatus(room, "choosing");

    client1.send("choice", { choice: "rock" });
    client2.send("choice", { choice: "scissors" });
    await waitForGameStatus(room, "result");

    await client1.leave();
    await client2.leave();
  }
}

async function runAbruptLeaveDuringChoosingCycles(
  colyseus: ColyseusTestServer,
  cycles: number,
): Promise<void> {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    const client1 = await colyseus.connectTo(room, {
      nickname: `choosing-a-${cycle}`,
    });
    const client2 = await colyseus.connectTo(room, {
      nickname: `choosing-b-${cycle}`,
    });

    await waitForGameStatus(room, "mode_select");

    client1.send("select_mode", { mode: "single" });
    await waitForGameStatus(room, "choosing");

    await client1.leave();
    await client2.leave();
  }
}

describe("Room churn lifecycle + plateau thresholds", () => {
  let colyseus: ColyseusTestServer;

  before(async () => {
    colyseus = await boot(appConfig);
  });

  after(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
    await waitForLifecycleConvergence("beforeEach cleanup");
  });

  it("normal leave cycle converges after cooldown", async function () {
    this.timeout(TEST_TIMEOUT_MS);

    const baseline = takeStats();

    await runNormalLeaveCycles(colyseus, NORMAL_CYCLES);

    const finalStats = await waitForLifecycleConvergence("normal leave cycle");
    assertLifecycleConvergence(finalStats, "normal leave cycle");
    assertBoundedTrend(baseline, finalStats, "normal leave cycle");
    await runCooldownAudit("normal_leave_cycle", baseline, finalStats);
  });

  it("abrupt leave during result converges after cooldown", async function () {
    this.timeout(TEST_TIMEOUT_MS);

    const baseline = takeStats();

    await runAbruptLeaveDuringResultCycles(colyseus, ABRUPT_RESULT_CYCLES);

    const finalStats = await waitForLifecycleConvergence("abrupt leave during result");
    assertLifecycleConvergence(finalStats, "abrupt leave during result");
    assertBoundedTrend(baseline, finalStats, "abrupt leave during result");
    await runCooldownAudit("abrupt_leave_during_result", baseline, finalStats);
  });

  it("abrupt leave during choosing converges after cooldown", async function () {
    this.timeout(TEST_TIMEOUT_MS);

    const baseline = takeStats();

    await runAbruptLeaveDuringChoosingCycles(colyseus, ABRUPT_CHOOSING_CYCLES);

    const finalStats = await waitForLifecycleConvergence("abrupt leave during choosing");
    assertLifecycleConvergence(finalStats, "abrupt leave during choosing");
    assertBoundedTrend(baseline, finalStats, "abrupt leave during choosing");
    await runCooldownAudit("abrupt_leave_during_choosing", baseline, finalStats);
  });
});
