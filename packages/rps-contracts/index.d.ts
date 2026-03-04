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

export declare const SERVER_MESSAGE_TYPES: {
  readonly ERROR: "error";
};

export type ServerMessageType = (typeof SERVER_MESSAGE_TYPES)[keyof typeof SERVER_MESSAGE_TYPES];

export declare const JOIN_ERROR_CODES: {
  readonly ROOM_FULL: "join.room_full";
  readonly DUPLICATE_SESSION: "join.duplicate_session";
  readonly INVALID_NICKNAME: "join.invalid_nickname";
};

export type JoinErrorCode = (typeof JOIN_ERROR_CODES)[keyof typeof JOIN_ERROR_CODES];

export declare const ACTION_ERROR_CODES: {
  readonly INVALID_STATE: "action.invalid_state";
  readonly NOT_HOST: "action.not_host";
  readonly INVALID_PAYLOAD: "action.invalid_payload";
  readonly INVALID_MODE: "action.invalid_mode";
  readonly INVALID_CHOICE: "action.invalid_choice";
  readonly ALREADY_CHOSEN: "action.already_chosen";
};

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[keyof typeof ACTION_ERROR_CODES];

export declare const TRANSPORT_ERROR_CODES: {
  readonly CONNECTION_LOST: "transport.connection_lost";
  readonly RECONNECT_EXPIRED: "transport.reconnect_expired";
  readonly RECONNECT_REJECTED: "transport.reconnect_rejected";
};

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[keyof typeof TRANSPORT_ERROR_CODES];

export type ErrorCode = JoinErrorCode | ActionErrorCode | TransportErrorCode;

export type ErrorBoundary = "join" | "action" | "transport";

export type NormalizedErrorCode = ErrorCode;

export declare const NORMALIZED_ERROR_CODES: {
  readonly ROOM_FULL: "join.room_full";
  readonly DUPLICATE_SESSION: "join.duplicate_session";
  readonly INVALID_NICKNAME: "join.invalid_nickname";
  readonly INVALID_STATE: "action.invalid_state";
  readonly NOT_HOST: "action.not_host";
  readonly INVALID_PAYLOAD: "action.invalid_payload";
  readonly INVALID_MODE: "action.invalid_mode";
  readonly INVALID_CHOICE: "action.invalid_choice";
  readonly ALREADY_CHOSEN: "action.already_chosen";
  readonly CONNECTION_LOST: "transport.connection_lost";
  readonly RECONNECT_EXPIRED: "transport.reconnect_expired";
  readonly RECONNECT_REJECTED: "transport.reconnect_rejected";
};

export type ErrorEnvelope = {
  boundary: ErrorBoundary;
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
};

export type TransportError = {
  code: TransportErrorCode;
  message: string;
  retryable: boolean;
};

export declare const RECONNECT_GRACE_SECONDS: 10;
export declare const RECONNECT_TOKEN_TTL_MS: number;
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
