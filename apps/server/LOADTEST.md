# Server Load Testing (Room Churn + Leak Signals)

This folder has two complementary checks:

- `npm -C apps/server run loadtest` runs the interactive `@colyseus/loadtest` CLI against a running server.
- `npm -C apps/server run loadtest:ci` runs a finite, deterministic churn loop intended for CI and repeatable local runs.

Both scripts are implemented in `apps/server/loadtest/`.

## Quick Start

1. Start the server (Terminal A):

```bash
npm -C apps/server run start:once
```

2. Run one of the loadtests (Terminal B):

```bash
npm -C apps/server run loadtest
```

or the deterministic CI-style runner:

```bash
npm -C apps/server run loadtest:ci
```

If you only want to see CLI flags:

```bash
npm -C apps/server run loadtest -- --help
npm -C apps/server run loadtest:ci -- --help
```

## Commands (Exact Repo Scripts)

Defined in `apps/server/package.json`:

- Local loadtest: `npm -C apps/server run loadtest`
  - Current script target: `tsx loadtest/example.ts --room my_room --numClients 2`
  - Uses `@colyseus/loadtest` in non-CI mode (interactive runner)

- Deterministic CI loadtest: `npm -C apps/server run loadtest:ci`
  - Current script target: `tsx loadtest/ci.ts`
  - Validates env, then runs `tsx loadtest/example.ts ...` in a finite mode that exits when done.

- Churn + leak regression: `npm -C apps/server test`
  - Runs `RoomChurn_test.ts` with environment-tunable churn loops and threshold checks in one command.

## Deterministic Runner Knobs (`loadtest:ci`)

`npm -C apps/server run loadtest:ci` reads these env vars:

- `RPS_CHURN_CONCURRENCY`
  - Default: `2`
  - Range: `1..64`
  - Meaning: number of clients (`--numClients`) used for the run.

- `RPS_CHURN_CYCLES`
  - Default: `2`
  - Range: `1..50`
  - Meaning: join + brief hold + leave cycles per client.

- `RPS_CHURN_SEED`
  - Default: `42`
  - Meaning: deterministic seed (safe integer `>= 0`) used to jitter hold timing.

Example:

```bash
RPS_CHURN_CONCURRENCY=8 RPS_CHURN_CYCLES=10 RPS_CHURN_SEED=7 npm -C apps/server run loadtest:ci
```

Notes:

- `loadtest:ci` always targets room name `my_room` (see `apps/server/loadtest/ci.ts`).
- `RPS_CI_LOADTEST=1` is set internally by `loadtest:ci` to force the finite runner path in `apps/server/loadtest/example.ts`.

## Room Churn Test Knobs (Mocha)

`apps/server/test/RoomChurn_test.ts` is a separate, server-in-process churn test (not the loadtest CLI). It uses `snapshot({ includeMemory: true, includeHandleCount: true })` and asserts lifecycle convergence plus bounded plateau thresholds.

Run it via the normal test script:

```bash
npm -C apps/server test
```

Env vars (defaults are from `apps/server/test/RoomChurn_test.ts`):

- `RPS_CHURN_TEST_TIMEOUT_MS` (default `90000`, range `10000..300000`)
- `RPS_CHURN_NORMAL_CYCLES` (default `8`, range `1..80`)
- `RPS_CHURN_ABRUPT_RESULT_CYCLES` (default `6`, range `1..80`)

- `RPS_CHURN_CONVERGENCE_TIMEOUT_MS` (default `12000`, range `2000..120000`)
- `RPS_CHURN_CONVERGENCE_POLL_MS` (default `100`, range `25..2000`)
- `RPS_CHURN_CONVERGENCE_COOLDOWN_MS` (default `1400`, range `500..10000`)

- `RPS_CHURN_MAX_HEAP_DELTA_BYTES` (default `50331648` aka 48 MiB)
- `RPS_CHURN_MAX_RSS_DELTA_BYTES` (default `100663296` aka 96 MiB)
- `RPS_CHURN_MAX_HANDLE_DELTA` (default `10`)

- `RPS_CHURN_MAX_HEAP_RATIO` (default `2.5`)
- `RPS_CHURN_MAX_RSS_RATIO` (default `1.8`)
- `RPS_CHURN_MAX_HANDLE_RATIO` (default `1.8`)

## Runtime Stats Snapshot (What to Watch)

In non-production only, the server exposes a compact JSON snapshot endpoint:

- `GET /__debug/stats` (mounted only when `NODE_ENV != "production"` in `apps/server/src/app.config.ts`)

Fields (from `apps/server/src/observability/runtimeStats.ts`):

- Lifecycle counters: `roomsCreated`, `roomsDisposed`, `joins`, `leaves`
- Gauges: `activeRooms`, `activeClients`
- Sampling: `capturedAt`
- Optional: `memory` (`rss`, `heapTotal`, `heapUsed`, `external`, `arrayBuffers`)
- Optional: `handles.activeHandleCount`

How to interpret:

- `roomsCreated` should eventually equal `roomsDisposed` after churn finishes.
- `activeRooms` and `activeClients` should return to `0` after a short cooldown.
- `handles.activeHandleCount` should not drift upward across repeated churn runs. A steady increase usually means a timer, interval, socket, or listener is not being cleaned up.
- `memory.heapUsed` and `memory.rss` are noisy, so use them as plateau signals, not single-sample truth. The churn test asserts bounded deltas and ratios for a stable baseline.

## Common Failure Patterns (Troubleshooting)

- Rooms not disposing
  - Symptom: churn test fails with `roomsCreated != roomsDisposed` or `activeRooms != 0` after the convergence window.
  - First checks: wait a bit longer (Colyseus auto-dispose is not immediate), ensure clients are actually leaving, and confirm you are not keeping seat reservations alive via reconnection flows.

- Timer or handle leaks
  - Symptom: `handles.activeHandleCount` grows run over run, or churn test fails `RPS_CHURN_MAX_HANDLE_*` thresholds.
  - Typical cause: untracked `setTimeout` / `setInterval` handles or event listeners that survive room disposal.

- Threshold breaches (heap/rss/handles)
  - Symptom: churn test fails `RPS_CHURN_MAX_HEAP_*`, `RPS_CHURN_MAX_RSS_*`, or `RPS_CHURN_MAX_HANDLE_*` assertions.
  - Interpretation: either a real retention issue, or the thresholds are too tight for the machine and workload. Prefer fixing the retention signal first; only widen thresholds with evidence.

- `loadtest:ci` exits with config validation errors
  - Symptom: non-zero exit with a message like `RPS_CHURN_CYCLES must be an integer between 1 and 50`.
  - Fix: set valid `RPS_CHURN_*` values, or unset them to use defaults.

- `loadtest` looks like it never exits
  - Expected: the interactive `@colyseus/loadtest` runner can keep the process alive.
  - Use `npm -C apps/server run loadtest:ci` for finite, repeatable runs.

## Production Safety

- Do not expose `GET /__debug/stats` publicly. It is mounted only when `NODE_ENV != "production"`, so `NODE_ENV=production` returns `404` for this route. Production deploys should still enforce that environment and avoid forwarding internal debug routes.
- Do not expose `/monitor` publicly without controls. The route is mounted in `apps/server/src/app.config.ts` with no auth gate, so production deployments must place it behind authentication/IP allowlisting and operational network policy.
