import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm -C ../server start:once",
      url: "http://127.0.0.1:2567",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm build && pnpm exec next start --port 3000",
      url: "http://127.0.0.1:3000",
      env: {
        NEXT_PUBLIC_COLYSEUS_URL: "ws://127.0.0.1:2567",
      },
      reuseExistingServer: !isCI,
      timeout: 300_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
