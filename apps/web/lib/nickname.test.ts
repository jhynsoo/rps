import { describe, expect, it } from "vitest";

import { MAX_NICKNAME_LENGTH, sanitizeNickname } from "@/lib/nickname";

describe("sanitizeNickname", () => {
  it("trims whitespace", () => {
    expect(sanitizeNickname("  player  ")).toBe("player");
  });

  it("caps value to configured max length", () => {
    expect(sanitizeNickname("123456789012345")).toBe("123456789012");
    expect(MAX_NICKNAME_LENGTH).toBe(12);
  });

  it("removes unsafe punctuation, format characters, and control characters", () => {
    expect(sanitizeNickname("  플레이어\t<red>\u200b\n")).toBe("플레이어 red");
  });
});
