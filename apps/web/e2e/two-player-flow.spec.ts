import { Client as ColyseusClient } from "colyseus.js";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

const UI_TIMEOUT_MS = 10_000;
const WS_TIMEOUT_MS = 15_000;

type MatchMode = "single" | "best_of_3" | "best_of_5";

type PlayerSession = {
  contextA: BrowserContext;
  contextB: BrowserContext;
  pageA: Page;
  pageB: Page;
  roomId: string;
};

function modeTestId(mode: MatchMode) {
  if (mode === "single") return "mode-single";
  if (mode === "best_of_3") return "mode-bo3";
  return "mode-bo5";
}

async function setNickname(page: Page, nickname: string) {
  await page.goto("/");
  await page.getByTestId("nickname-input").fill(nickname);
  await page.getByTestId("nickname-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: UI_TIMEOUT_MS });
}

async function createAndJoinRoom(
  browser: Browser,
  nicknameA: string,
  nicknameB: string,
): Promise<PlayerSession> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await setNickname(pageA, nicknameA);
  await pageA.getByTestId("nav-create-room").click();
  await expect(pageA).toHaveURL(/\/room\/(?!create$)[^/]+$/, {
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageA.getByTestId("player-list")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });

  const match = pageA.url().match(/\/room\/([^/]+)$/);
  const roomId = match?.[1]?.trim() ?? "";
  expect(roomId).not.toBe("");

  await setNickname(pageB, nicknameB);
  await pageB.getByTestId("nav-join-room").click();
  await expect(pageB).toHaveURL(/\/room\/join$/, { timeout: UI_TIMEOUT_MS });
  await expect(pageB.getByTestId("join-submit")).toBeEnabled({
    timeout: WS_TIMEOUT_MS,
  });
  await pageB.getByTestId("roomid-input").fill(roomId);
  await pageB.getByTestId("join-submit").click();
  await expect(pageB.getByTestId("room-error")).toHaveCount(0);

  await expect(pageB).toHaveURL(new RegExp(`/room/${roomId}$`), {
    timeout: WS_TIMEOUT_MS,
  });

  await expect(pageA.getByTestId("player-list").locator("li")).toHaveCount(2, {
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB.getByTestId("player-list").locator("li")).toHaveCount(2, {
    timeout: WS_TIMEOUT_MS,
  });

  return { contextA, contextB, pageA, pageB, roomId };
}

async function startMatch(pageA: Page, pageB: Page, roomId: string, mode: MatchMode) {
  await expect(pageA.getByTestId("start-game")).toBeEnabled({
    timeout: WS_TIMEOUT_MS,
  });
  await pageA.getByTestId(modeTestId(mode)).click();
  await pageA.getByTestId("start-game").click();

  await expect(pageA).toHaveURL(new RegExp(`/game/${roomId}$`), {
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB).toHaveURL(new RegExp(`/game/${roomId}$`), {
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageA.getByTestId("countdown")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB.getByTestId("countdown")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
}

async function playHostWinningRound(pageA: Page, pageB: Page) {
  await expect(pageA.getByTestId("choice-rock")).toBeEnabled({
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB.getByTestId("choice-scissors")).toBeEnabled({
    timeout: WS_TIMEOUT_MS,
  });

  await Promise.all([
    pageA.getByTestId("choice-rock").click(),
    pageB.getByTestId("choice-scissors").click(),
  ]);

  await expect(pageA.getByTestId("round-winner")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB.getByTestId("round-winner")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
}

async function finishMatch(pageA: Page, pageB: Page, roundsToWin: number) {
  for (let round = 1; round <= roundsToWin; round += 1) {
    await playHostWinningRound(pageA, pageB);

    if (round < roundsToWin) {
      await expect(pageA.getByTestId("countdown")).toBeVisible({
        timeout: WS_TIMEOUT_MS,
      });
    }
  }

  await expect(pageA.getByTestId("match-winner")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
  await expect(pageB.getByTestId("match-winner")).toBeVisible({
    timeout: WS_TIMEOUT_MS,
  });
}

async function closePlayerSession(session: PlayerSession) {
  await session.contextA.close();
  await session.contextB.close();
}

test("create/join + single mode full match", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceSingle", "BobSingle");

  try {
    await startMatch(session.pageA, session.pageB, session.roomId, "single");
    await finishMatch(session.pageA, session.pageB, 1);

    await session.pageA.getByTestId("back-to-room").click();
    await expect(session.pageA).toHaveURL(new RegExp(`/room/${session.roomId}$`), {
      timeout: WS_TIMEOUT_MS,
    });
  } finally {
    await closePlayerSession(session);
  }
});

test("language toggle mid-flow keeps two-player game playable", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceLocale", "BobLocale");

  try {
    await session.pageA.getByTestId("lang-toggle-ko").click();
    await expect(session.pageA.locator("html")).toHaveAttribute("lang", "ko", {
      timeout: UI_TIMEOUT_MS,
    });

    await session.pageA.getByTestId("lang-toggle-en").click();
    await expect(session.pageA.locator("html")).toHaveAttribute("lang", "en", {
      timeout: UI_TIMEOUT_MS,
    });

    await startMatch(session.pageA, session.pageB, session.roomId, "single");

    await expect(session.pageA.getByTestId("choice-rock")).toHaveText("Rock", {
      timeout: WS_TIMEOUT_MS,
    });

    await playHostWinningRound(session.pageA, session.pageB);

    await expect(session.pageA.locator("html")).toHaveAttribute("lang", "en", {
      timeout: UI_TIMEOUT_MS,
    });
  } finally {
    await closePlayerSession(session);
  }
});

test("best_of_3 full match", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceBo3", "BobBo3");

  try {
    await startMatch(session.pageA, session.pageB, session.roomId, "best_of_3");
    await finishMatch(session.pageA, session.pageB, 2);
  } finally {
    await closePlayerSession(session);
  }
});

test("best_of_5 full match", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceBo5", "BobBo5");

  try {
    await startMatch(session.pageA, session.pageB, session.roomId, "best_of_5");
    await finishMatch(session.pageA, session.pageB, 3);
  } finally {
    await closePlayerSession(session);
  }
});

test("rematch keeps same roomId", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceRematch", "BobRematch");

  try {
    await startMatch(session.pageA, session.pageB, session.roomId, "single");
    await finishMatch(session.pageA, session.pageB, 1);

    await session.pageA.getByTestId("rematch-ready").click();
    await expect(session.pageA.getByTestId("rematch-status")).toContainText("1/2", {
      timeout: WS_TIMEOUT_MS,
    });

    await session.pageB.getByTestId("rematch-ready").click();

    await expect(session.pageA).toHaveURL(new RegExp(`/room/${session.roomId}$`), {
      timeout: WS_TIMEOUT_MS,
    });
    await expect(session.pageB).toHaveURL(new RegExp(`/room/${session.roomId}$`), {
      timeout: WS_TIMEOUT_MS,
    });
    await expect(session.pageA.getByTestId("mode-single")).toBeVisible({
      timeout: WS_TIMEOUT_MS,
    });
    await expect(session.pageA.getByTestId("player-list").locator("li")).toHaveCount(2, {
      timeout: WS_TIMEOUT_MS,
    });
  } finally {
    await closePlayerSession(session);
  }
});

test("invalid roomId shows room error", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setNickname(page, "ErrorCase");
    await page.getByTestId("nav-join-room").click();
    await expect(page).toHaveURL(/\/room\/join$/, { timeout: UI_TIMEOUT_MS });
    await expect(page.getByTestId("join-submit")).toBeEnabled({
      timeout: WS_TIMEOUT_MS,
    });

    await page.getByTestId("roomid-input").fill("invalid-room-id");
    await page.getByTestId("join-submit").click();

    await expect(page.getByTestId("room-error")).toBeVisible({
      timeout: WS_TIMEOUT_MS,
    });
    await expect(page.getByTestId("room-error")).not.toHaveText("", {
      timeout: UI_TIMEOUT_MS,
    });
  } finally {
    await context.close();
  }
});

test("joiner disconnect in room lobby is reflected immediately on host", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceLobbyDisc", "BobLobbyDisc");

  try {
    await session.pageB.evaluate(() => {
      window.dispatchEvent(new Event("rps:force-disconnect"));
    });

    await expect(session.pageA.getByTestId("player-list").locator("li")).toHaveCount(1, {
      timeout: WS_TIMEOUT_MS,
    });
  } finally {
    await closePlayerSession(session);
  }
});

test("reconnect resume with token restores active game session", async ({ browser }) => {
  const session = await createAndJoinRoom(browser, "AliceReconnect", "BobReconnect");

  try {
    await startMatch(session.pageA, session.pageB, session.roomId, "single");

    await session.pageA.evaluate(() => {
      window.dispatchEvent(new Event("rps:force-disconnect"));
    });

    await expect
      .poll(
        async () =>
          session.pageA.evaluate(() => window.localStorage.getItem("rps:reconnect:v1")),
        { timeout: WS_TIMEOUT_MS },
      )
      .not.toBeNull();

    const reconnectSnapshot = await session.pageA.evaluate(() =>
      window.localStorage.getItem("rps:reconnect:v1"),
    );
    if (!reconnectSnapshot) {
      throw new Error("Reconnect snapshot missing from localStorage");
    }

    const parsedSnapshot = JSON.parse(reconnectSnapshot) as { token: string };
    const reconnectClient = new ColyseusClient("ws://127.0.0.1:2567");
    const resumedRoom = await reconnectClient.reconnect(parsedSnapshot.token);

    resumedRoom.send("choice", { choice: "rock" });
    await session.pageB.getByTestId("choice-scissors").click();

    await expect(session.pageB.getByTestId("round-winner")).toBeVisible({
      timeout: WS_TIMEOUT_MS,
    });

    await resumedRoom.leave();
  } finally {
    await closePlayerSession(session);
  }
});
