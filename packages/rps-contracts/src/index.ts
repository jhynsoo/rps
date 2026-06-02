export const GAME_STATUSES = ["waiting", "mode_select", "choosing", "result", "finished"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_MODES = ["single", "best_of_3", "best_of_5"] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const RPS_CHOICES = ["rock", "paper", "scissors"] as const;

export type RpsChoice = (typeof RPS_CHOICES)[number];

export const CLIENT_MESSAGE_TYPES = {
  SELECT_MODE: "select_mode",
  CHOICE: "choice",
  REMATCH_READY: "rematch_ready",
  REMATCH_CANCEL: "rematch_cancel",
} as const;

export type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[keyof typeof CLIENT_MESSAGE_TYPES];

export const SERVER_MESSAGE_TYPES = {
  ERROR: "error",
} as const;

export type ServerMessageType = (typeof SERVER_MESSAGE_TYPES)[keyof typeof SERVER_MESSAGE_TYPES];

export const JOIN_ERROR_CODES = {
  ROOM_FULL: "join.room_full",
  DUPLICATE_SESSION: "join.duplicate_session",
  INVALID_NICKNAME: "join.invalid_nickname",
} as const;

export type JoinErrorCode = (typeof JOIN_ERROR_CODES)[keyof typeof JOIN_ERROR_CODES];

export const ACTION_ERROR_CODES = {
  INVALID_STATE: "action.invalid_state",
  NOT_HOST: "action.not_host",
  INVALID_PAYLOAD: "action.invalid_payload",
  INVALID_MODE: "action.invalid_mode",
  INVALID_CHOICE: "action.invalid_choice",
  ALREADY_CHOSEN: "action.already_chosen",
} as const;

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[keyof typeof ACTION_ERROR_CODES];

export const TRANSPORT_ERROR_CODES = {
  CONNECTION_LOST: "transport.connection_lost",
  RECONNECT_EXPIRED: "transport.reconnect_expired",
  RECONNECT_REJECTED: "transport.reconnect_rejected",
} as const;

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[keyof typeof TRANSPORT_ERROR_CODES];

export type ErrorCode = JoinErrorCode | ActionErrorCode | TransportErrorCode;

export type ErrorBoundary = "join" | "action" | "transport";

export type NormalizedErrorCode = ErrorCode;

export const NORMALIZED_ERROR_CODES = {
  ...JOIN_ERROR_CODES,
  ...ACTION_ERROR_CODES,
  ...TRANSPORT_ERROR_CODES,
} as const;

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

export const RECONNECT_GRACE_SECONDS = 10;
export const RECONNECT_TOKEN_TTL_MS = RECONNECT_GRACE_SECONDS * 1000;
export const RECONNECT_STORAGE_KEY = "rps:reconnect:v1";

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
