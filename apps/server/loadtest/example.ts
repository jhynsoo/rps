import { cli } from "@colyseus/loadtest";

const HOLD_MS = 250;
const HOLD_JITTER_MS = 50;
const CI_DEFAULT_CYCLES = 2;
const CI_MAX_CYCLES = 50;
const CI_DEFAULT_SEED = 42;
const CI_MAX_CONCURRENCY = 64;

type LoadtestClient = {
  new (
    endpoint: string,
  ): {
    joinOrCreate(
      roomName: string,
      options: Record<string, unknown>,
    ): Promise<{ leave: () => Promise<void> }>;
  };
};

const { Client } = require("colyseus.js") as { Client: LoadtestClient };

type LoadtestOptions = {
  endpoint: string;
  roomName: string;
  numClients?: number;
};

type CiConfig = {
  cycles: number;
  seed: number;
};

function parseFiniteInt(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    throw new Error(`invalid ${name}: expected integer`);
  }

  return parsed;
}

function assertPositiveInt(value: number, name: string, max: number): void {
  if (value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
}

function getCiConfig(options: LoadtestOptions): CiConfig {
  const parsedCycles = parseFiniteInt(process.env.RPS_CHURN_CYCLES, "RPS_CHURN_CYCLES");
  const parsedConcurrency = parseFiniteInt(
    process.env.RPS_CHURN_CONCURRENCY,
    "RPS_CHURN_CONCURRENCY",
  );
  const parsedSeed = parseFiniteInt(process.env.RPS_CHURN_SEED, "RPS_CHURN_SEED");
  const cycles = parsedCycles ?? CI_DEFAULT_CYCLES;
  const seed = parsedSeed === undefined ? CI_DEFAULT_SEED : parsedSeed;
  assertPositiveInt(cycles, "RPS_CHURN_CYCLES", CI_MAX_CYCLES);

  if (seed < 0 || seed > Number.MAX_SAFE_INTEGER) {
    throw new Error("RPS_CHURN_SEED must be a safe integer >= 0");
  }

  if (!Number.isInteger(options.numClients) || options.numClients === undefined) {
    throw new Error("loadtest options missing --numClients for deterministic CI baseline");
  }

  const effectiveConcurrency = parsedConcurrency ?? options.numClients;

  if (parsedConcurrency !== undefined) {
    assertPositiveInt(parsedConcurrency, "RPS_CHURN_CONCURRENCY", CI_MAX_CONCURRENCY);

    if (parsedConcurrency !== options.numClients) {
      throw new Error(
        `RPS_CHURN_CONCURRENCY (${parsedConcurrency}) must match CLI --numClients (${options.numClients})`,
      );
    }
  }

  assertPositiveInt(options.numClients, "RPS_CHURN_CONCURRENCY (--numClients)", CI_MAX_CONCURRENCY);
  assertPositiveInt(effectiveConcurrency, "effective concurrency", CI_MAX_CONCURRENCY);

  return {
    cycles,
    seed,
  };
}

function makeRng(seed: number): () => number {
  let state = Math.imul(seed, 1103515245) >>> 0;

  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseCliArgs(argv: string[]): {
  endpoint: string;
  roomName?: string;
  numClients?: number;
} {
  const args = new Map<string, string | undefined>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      continue;
    }

    if (arg.includes("=")) {
      const [flag, rawValue] = arg.split("=");
      args.set(flag, rawValue);
      continue;
    }

    const value = argv[i + 1];

    if (value !== undefined && !value.startsWith("--")) {
      args.set(arg, value);
      i += 1;
      continue;
    }

    args.set(arg, undefined);
  }

  const roomName = args.get("--room") ?? args.get("--roomId");
  const endpoint = args.get("--endpoint") ?? "ws://localhost:2567";
  const numClientsRaw = args.get("--numClients");
  const numClients =
    numClientsRaw === undefined || numClientsRaw === "" ? undefined : Number(numClientsRaw);

  return {
    endpoint,
    roomName,
    numClients,
  };
}

async function runDirectCli(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2));

  if (parsedArgs.roomName === undefined) {
    throw new Error("loadtest requires --room (or --roomId) when running in CI mode");
  }

  const options: LoadtestOptions = {
    endpoint: parsedArgs.endpoint,
    roomName: parsedArgs.roomName,
    numClients: parsedArgs.numClients,
  };

  await main(options);
  process.exit(0);
}

async function main(options: LoadtestOptions): Promise<void> {
  const { cycles, seed } = getCiConfig(options);
  const rng = makeRng(seed);
  const client = new Client(options.endpoint);

  for (let i = 0; i < cycles; i += 1) {
    const room = await client.joinOrCreate(options.roomName, {});
    const jitterMs = Math.floor(HOLD_JITTER_MS * rng());
    await sleep(HOLD_MS + jitterMs);
    await room.leave();
  }
}

if (process.env.RPS_CI_LOADTEST === "1") {
  void runDirectCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else {
  cli(main);
}
