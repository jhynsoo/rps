import { describe, expect, it } from "vitest";

import { resolveStoredNickname } from "@/lib/nickname-session";

describe("resolveStoredNickname", () => {
  it("returns a sanitized nickname when present", () => {
    expect(resolveStoredNickname("  player  ")).toEqual({
      nickname: "player",
      shouldClear: false,
      shouldRedirectHome: false,
    });
  });

  it("marks invalid stored values for clearing and redirect", () => {
    expect(resolveStoredNickname("   ")).toEqual({
      nickname: null,
      shouldClear: true,
      shouldRedirectHome: true,
    });
  });

  it("redirects without clearing when no value exists", () => {
    expect(resolveStoredNickname(null)).toEqual({
      nickname: null,
      shouldClear: false,
      shouldRedirectHome: true,
    });
  });
});
