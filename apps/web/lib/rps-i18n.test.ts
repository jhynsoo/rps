import { describe, expect, it } from "vitest";

import {
  gameModeMessage,
  gameStatusMessage,
  isGameMode,
  isGameStatus,
  isRpsChoice,
  rpsChoiceMessage,
} from "@/lib/rps-i18n";

describe("isGameStatus", () => {
  it("returns true for known statuses", () => {
    expect(isGameStatus("waiting")).toBe(true);
    expect(isGameStatus("mode_select")).toBe(true);
    expect(isGameStatus("choosing")).toBe(true);
    expect(isGameStatus("result")).toBe(true);
    expect(isGameStatus("finished")).toBe(true);
  });

  it("returns false for unknown statuses", () => {
    expect(isGameStatus("unknown")).toBe(false);
    expect(isGameStatus("")).toBe(false);
  });
});

describe("isGameMode", () => {
  it("returns true for known modes", () => {
    expect(isGameMode("single")).toBe(true);
    expect(isGameMode("best_of_3")).toBe(true);
    expect(isGameMode("best_of_5")).toBe(true);
  });

  it("returns false for unknown modes", () => {
    expect(isGameMode("bo3")).toBe(false);
    expect(isGameMode("")).toBe(false);
  });
});

describe("isRpsChoice", () => {
  it("returns true for known choices", () => {
    expect(isRpsChoice("rock")).toBe(true);
    expect(isRpsChoice("paper")).toBe(true);
    expect(isRpsChoice("scissors")).toBe(true);
  });

  it("returns false for unknown choices", () => {
    expect(isRpsChoice("lizard")).toBe(false);
    expect(isRpsChoice("")).toBe(false);
  });
});

describe("gameStatusMessage", () => {
  it("maps known status codes to stable game keys", () => {
    expect(gameStatusMessage("waiting")).toEqual({ key: "status.waiting" });
    expect(gameStatusMessage("mode_select")).toEqual({ key: "status.mode_select" });
    expect(gameStatusMessage("choosing")).toEqual({ key: "status.choosing" });
    expect(gameStatusMessage("result")).toEqual({ key: "status.result" });
    expect(gameStatusMessage("finished")).toEqual({ key: "status.finished" });
  });

  it("uses an explicit fallback key for unknown status codes", () => {
    expect(gameStatusMessage("invalid_status")).toEqual({
      key: "status.unknown",
      values: { status: "invalid_status" },
    });
  });
});

describe("gameModeMessage", () => {
  it("maps known mode codes to stable game keys", () => {
    expect(gameModeMessage("single")).toEqual({ key: "mode.single" });
    expect(gameModeMessage("best_of_3")).toEqual({ key: "mode.best_of_3" });
    expect(gameModeMessage("best_of_5")).toEqual({ key: "mode.best_of_5" });
  });

  it("uses an explicit fallback key for unknown mode codes", () => {
    expect(gameModeMessage("invalid_mode")).toEqual({
      key: "mode.unknown",
      values: { mode: "invalid_mode" },
    });
  });
});

describe("rpsChoiceMessage", () => {
  it("maps known choice codes to stable game keys", () => {
    expect(rpsChoiceMessage("rock")).toEqual({ key: "choices.rock" });
    expect(rpsChoiceMessage("paper")).toEqual({ key: "choices.paper" });
    expect(rpsChoiceMessage("scissors")).toEqual({ key: "choices.scissors" });
  });

  it("uses an explicit fallback key for unknown choice codes", () => {
    expect(rpsChoiceMessage("invalid_choice")).toEqual({
      key: "choices.unknown",
      values: { choice: "invalid_choice" },
    });
  });
});
