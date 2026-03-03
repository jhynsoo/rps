import { expect, type Page, test } from "@playwright/test";

const UI_TIMEOUT_MS = 10_000;
const EN_HOME_PROMPT = "Pick a nickname";
const KO_HOME_PROMPT = "닉네임을 정해주세요";

async function switchToEnglish(page: Page) {
  await page.getByTestId("lang-toggle-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en", {
    timeout: UI_TIMEOUT_MS,
  });
}

test("language toggle persists after reload", async ({ page }) => {
  await page.goto("/");

  await switchToEnglish(page);
  await expect(page.getByTestId("home-nickname-prompt")).toHaveText(EN_HOME_PROMPT);

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "en", {
    timeout: UI_TIMEOUT_MS,
  });
  await expect(page.getByTestId("home-nickname-prompt")).toHaveText(EN_HOME_PROMPT);
});

test("language toggle persists on /menu navigation", async ({ page }) => {
  const nickname = "PersistNav";

  await page.goto("/");

  await switchToEnglish(page);
  await expect(page.getByTestId("home-nickname-prompt")).toHaveText(EN_HOME_PROMPT);

  await page.getByTestId("nickname-input").fill(nickname);
  await page.getByTestId("nickname-submit").click();

  await expect(page).toHaveURL(/\/menu$/, { timeout: UI_TIMEOUT_MS });
  await expect(page.locator("html")).toHaveAttribute("lang", "en", {
    timeout: UI_TIMEOUT_MS,
  });
  await expect(page.getByTestId("lobby-title")).toHaveText(`Welcome, ${nickname}`);
});

test("no cookie + Accept-Language en-US defaults to English", async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "Accept-Language": "en-US",
    },
  });

  try {
    await context.clearCookies();

    const preloadedLocaleCookie = (await context.cookies("http://127.0.0.1:3000")).find(
      (cookie) => cookie.name === "locale",
    );
    expect(preloadedLocaleCookie).toBeUndefined();

    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en", {
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByTestId("home-nickname-prompt")).toHaveText(EN_HOME_PROMPT);
  } finally {
    await context.close();
  }
});

test("invalid locale cookie falls back to Korean", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "fr-FR",
  });

  try {
    await context.addCookies([
      {
        name: "locale",
        value: "fr",
        url: "http://127.0.0.1:3000",
      },
    ]);

    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko", {
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByTestId("home-nickname-prompt")).toHaveText(KO_HOME_PROMPT);
  } finally {
    await context.close();
  }
});
