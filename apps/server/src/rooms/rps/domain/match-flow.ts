import { GAME_MODES, RPS_CHOICES } from "@rps/contracts";

import type { PlayerState } from "../schema/RpsRoomState";

export const VALID_MODES = GAME_MODES as readonly string[];
export const VALID_CHOICES = RPS_CHOICES as readonly string[];

const WIN_MAP: Record<string, string> = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSelectModeMessage(value: unknown): value is { mode: string } {
  if (!isRecord(value)) return false;
  return typeof value.mode === "string";
}

export function isChoiceMessage(value: unknown): value is { choice: string } {
  if (!isRecord(value)) return false;
  return typeof value.choice === "string";
}

export function isValidMode(mode: string): boolean {
  return VALID_MODES.includes(mode);
}

export function isValidChoice(choice: string): boolean {
  return VALID_CHOICES.includes(choice);
}

export function assignRandomChoices(players: Iterable<PlayerState>): void {
  for (const player of players) {
    if (player.choice !== "") continue;

    const randomIndex = Math.floor(Math.random() * VALID_CHOICES.length);
    player.choice = VALID_CHOICES[randomIndex];
  }
}

export function areAllPlayersChosen(players: Iterable<PlayerState>): boolean {
  for (const player of players) {
    if (player.choice === "") {
      return false;
    }
  }

  return true;
}

export function determineRoundWinner(players: PlayerState[]): string {
  if (players.length < 2) return "";

  const p1 = players[0];
  const p2 = players[1];

  if (p1.choice === p2.choice) {
    return "draw";
  }

  if (WIN_MAP[p1.choice] === p2.choice) {
    p1.score += 1;
    return p1.sessionId;
  }

  p2.score += 1;
  return p2.sessionId;
}

export function getWinThreshold(gameMode: string): number {
  switch (gameMode) {
    case "single":
      return 1;
    case "best_of_3":
      return 2;
    case "best_of_5":
      return 3;
    default:
      return 1;
  }
}

export function clearPlayerChoices(players: Iterable<PlayerState>): void {
  for (const player of players) {
    player.choice = "";
  }
}
