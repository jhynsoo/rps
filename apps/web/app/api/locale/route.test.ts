import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/locale/route";

const postLocale = async (payload: unknown) =>
  POST(
    new Request("http://localhost/api/locale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );

describe("POST /api/locale", () => {
  it("sets locale=en for valid input", async () => {
    const response = await postLocale({ locale: "en" });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("locale=en");
  });

  it("normalizes invalid locale input to ko", async () => {
    const response = await postLocale({ locale: "fr" });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("locale=ko");
  });

  it("falls back to ko when locale is missing or empty", async () => {
    const missingLocaleResponse = await postLocale({});
    const emptyLocaleResponse = await postLocale({ locale: "" });

    expect(missingLocaleResponse.status).toBe(204);
    expect(missingLocaleResponse.headers.get("set-cookie")).toContain("locale=ko");

    expect(emptyLocaleResponse.status).toBe(204);
    expect(emptyLocaleResponse.headers.get("set-cookie")).toContain("locale=ko");
  });
});
