const DEFAULT_TEST_PORT = 2568;
const MIN_PORT = 1;
const MAX_PORT = 65535;

export function resolveTestPort(defaultPort = DEFAULT_TEST_PORT): number {
  const rawValue = process.env.RPS_TEST_PORT;

  if (!rawValue || rawValue.trim().length === 0) {
    return defaultPort;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
    throw new Error(`RPS_TEST_PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}`);
  }

  return parsed;
}
