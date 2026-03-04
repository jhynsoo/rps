import { expect, test } from "@playwright/test";

const UI_TIMEOUT_MS = 10_000;
const WS_TIMEOUT_MS = 15_000;

test("error contract: reconnect 없이 game 접근 시 joinUnavailable 표시", async ({ page }) => {
  const roomId = "contract-join-unavailable";

  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.removeItem("rps:reconnect:v1");
  });

  await page.goto(`/game/${roomId}`);

  await expect(page.getByText("No active room")).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await expect(page.getByText("Failed to join or restore the room session.")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
});

test("error contract: 만료된 reconnect snapshot은 reconnectExpired로 노출", async ({ page }) => {
  const roomId = "contract-expired-reconnect";

  await page.goto("/");
  await page.evaluate((targetRoomId) => {
    window.localStorage.setItem(
      "rps:reconnect:v1",
      JSON.stringify({
        roomId: targetRoomId,
        token: "expired-token",
        expiresAt: Date.now() - 10_000,
      }),
    );
  }, roomId);

  await page.goto(`/result/${roomId}`);

  await expect(page.getByText("Reconnect session expired. Please join again.")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
});
