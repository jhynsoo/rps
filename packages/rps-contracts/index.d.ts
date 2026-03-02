export declare const GAME_STATUSES: readonly [
  "waiting",
  "mode_select",
  "choosing",
  "result",
  "finished",
];

export type GameStatus = (typeof GAME_STATUSES)[number];

export declare const GAME_MODES: readonly ["single", "best_of_3", "best_of_5"];

export type GameMode = (typeof GAME_MODES)[number];

export declare const RPS_CHOICES: readonly ["rock", "paper", "scissors"];

export type RpsChoice = (typeof RPS_CHOICES)[number];

export declare const CLIENT_MESSAGE_TYPES: {
  readonly SELECT_MODE: "select_mode";
  readonly CHOICE: "choice";
  readonly REMATCH_READY: "rematch_ready";
  readonly REMATCH_CANCEL: "rematch_cancel";
};

export type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[keyof typeof CLIENT_MESSAGE_TYPES];

export declare const RECONNECT_GRACE_SECONDS: 10;
export declare const RECONNECT_TOKEN_TTL_MS: 600000;
export declare const RECONNECT_STORAGE_KEY: "rps:reconnect:v1";

export type ReconnectSnapshot = {
  roomId: string;
  token: string;
  expiresAt: number;
};

export type PlayerStateView = {
  sessionId: string;
  nickname: string;
  choice: string;
  score: number;
  isReady: boolean;
};

export type RoomStateView = {
  players: {
    size: number;
    values: () => IterableIterator<PlayerStateView>;
  };
  hostSessionId: string;
  gameStatus: string;
  gameMode: string;
  countdown: number;
  winner: string;
  roundNumber: number;
};
