import { spawnSync } from "node:child_process";

const CI_MAX_CONCURRENCY = 64;
const CI_DEFAULT_CONCURRENCY = 2;
const CI_MAX_CYCLES = 50;
const CI_DEFAULT_CYCLES = 2;
const CI_DEFAULT_SEED = 42;

function parsePositiveInt(
  value: string | undefined,
  name: string,
  max: number,
  fallback: number,
): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }

  return parsed;
}

function parseSafeSeed(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || !Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer >= 0`);
  }

  return parsed;
}

const concurrency = parsePositiveInt(
  process.env.RPS_CHURN_CONCURRENCY,
  "RPS_CHURN_CONCURRENCY",
  CI_MAX_CONCURRENCY,
  CI_DEFAULT_CONCURRENCY,
);
const cycles = parsePositiveInt(
  process.env.RPS_CHURN_CYCLES,
  "RPS_CHURN_CYCLES",
  CI_MAX_CYCLES,
  CI_DEFAULT_CYCLES,
);
const seed = parseSafeSeed(process.env.RPS_CHURN_SEED, "RPS_CHURN_SEED", CI_DEFAULT_SEED);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  const helpResult = spawnSync("tsx", ["loadtest/example.ts", "--help"], {
    stdio: "inherit",
  });

  process.exit(helpResult.status ?? 1);
}

const loadtestArgs = [
  "loadtest/example.ts",
  "--room",
  "my_room",
  "--numClients",
  String(concurrency),
  ...process.argv.slice(2),
];

const result = spawnSync("tsx", loadtestArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    RPS_CI_LOADTEST: "1",
    RPS_CHURN_CYCLES: String(cycles),
    RPS_CHURN_CONCURRENCY: String(concurrency),
    RPS_CHURN_SEED: String(seed),
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
