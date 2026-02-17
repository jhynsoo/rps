import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import ko from "@/messages/ko.json";

type MessageBundle = Record<string, unknown>;

function flattenKeys(values: MessageBundle, prefix = ""): string[] {
  return Object.entries(values).flatMap(([key, value]) => {
    const current = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value as MessageBundle, current);
    }

    return [current];
  });
}

function keyParityDiff(
  actual: MessageBundle,
  expected: MessageBundle,
): { missing: string[]; extra: string[] } {
  const actualSet = new Set(flattenKeys(actual));
  const expectedSet = new Set(flattenKeys(expected));

  return {
    missing: [...expectedSet].filter((key) => !actualSet.has(key)).sort(),
    extra: [...actualSet].filter((key) => !expectedSet.has(key)).sort(),
  };
}

describe("message catalog key parity", () => {
  it("keeps ko and en keys identical", () => {
    const { missing, extra } = keyParityDiff(ko, en);
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("detects parity mismatch with in-memory fixtures", () => {
    const fixtureReference: MessageBundle = {
      lang: {
        ko: "ko",
        en: "en",
      },
      home: {
        title: "Home title",
        nicknamePrompt: "Prompt",
      },
      lobby: {
        title: "Lobby title",
        subtitle: "Lobby subtitle",
      },
    };

    const fixtureWithMissingKey: MessageBundle = {
      lang: {
        ko: "ko",
        en: "en",
      },
      home: {
        title: "Home title",
        nicknamePrompt: "Prompt",
      },
      lobby: {
        title: "Lobby title",
      },
    };

    const fixtureWithExtraKey: MessageBundle = {
      lang: {
        ko: "ko",
        en: "en",
      },
      home: {
        title: "Home title",
        nicknamePrompt: "Prompt",
        extraLabel: "Should be detected",
      },
      lobby: {
        title: "Lobby title",
        subtitle: "Lobby subtitle",
      },
    };

    const missingResult = keyParityDiff(fixtureWithMissingKey, fixtureReference);
    const extraResult = keyParityDiff(fixtureWithExtraKey, fixtureReference);

    expect(missingResult.missing).toEqual(["lobby.subtitle"]);
    expect(missingResult.extra).toEqual([]);

    expect(extraResult.missing).toEqual([]);
    expect(extraResult.extra).toEqual(["home.extraLabel"]);
  });
});
