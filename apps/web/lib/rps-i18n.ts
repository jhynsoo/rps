import {
  GAME_MODES,
  GAME_STATUSES,
  type GameMode,
  type GameStatus,
  RPS_CHOICES,
  type RpsChoice,
} from "@/lib/rps";

const GAME_STATUS_SET = new Set<string>(GAME_STATUSES as readonly string[]);
const GAME_MODE_SET = new Set<string>(GAME_MODES as readonly string[]);
const RPS_CHOICE_SET = new Set<string>(RPS_CHOICES as readonly string[]);

export function isGameStatus(value: string): value is GameStatus {
  return GAME_STATUS_SET.has(value);
}

export function isGameMode(value: string): value is GameMode {
  return GAME_MODE_SET.has(value);
}

export function isRpsChoice(value: string): value is RpsChoice {
  return RPS_CHOICE_SET.has(value);
}

export type GameStatusMessage =
  | { key: `status.${GameStatus}` }
  | { key: "status.unknown"; values: { status: string } };

export function gameStatusMessage(status: GameStatus): { key: `status.${GameStatus}` };
export function gameStatusMessage(status: string): GameStatusMessage;
export function gameStatusMessage(status: string): GameStatusMessage {
  if (isGameStatus(status)) return { key: `status.${status}` };
  return { key: "status.unknown", values: { status } };
}

export type GameModeMessage =
  | { key: `mode.${GameMode}` }
  | { key: "mode.unknown"; values: { mode: string } };

export function gameModeMessage(mode: GameMode): { key: `mode.${GameMode}` };
export function gameModeMessage(mode: string): GameModeMessage;
export function gameModeMessage(mode: string): GameModeMessage {
  if (isGameMode(mode)) return { key: `mode.${mode}` };
  return { key: "mode.unknown", values: { mode } };
}

export type RpsChoiceMessage =
  | { key: `choices.${RpsChoice}` }
  | { key: "choices.unknown"; values: { choice: string } };

export function rpsChoiceMessage(choice: RpsChoice): { key: `choices.${RpsChoice}` };
export function rpsChoiceMessage(choice: string): RpsChoiceMessage;
export function rpsChoiceMessage(choice: string): RpsChoiceMessage {
  if (isRpsChoice(choice)) return { key: `choices.${choice}` };
  return { key: "choices.unknown", values: { choice } };
}
