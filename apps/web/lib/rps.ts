export const GAME_STATUSES = [
  "waiting",
  "mode_select",
  "choosing",
  "result",
  "finished",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_MODES = ["single", "best_of_3", "best_of_5"] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const RPS_CHOICES = ["rock", "paper", "scissors"] as const;

export type RpsChoice = (typeof RPS_CHOICES)[number];
