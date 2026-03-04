export const GAME_STATUSES = ["waiting", "mode_select", "choosing", "result", "finished"];

export const GAME_MODES = ["single", "best_of_3", "best_of_5"];

export const RPS_CHOICES = ["rock", "paper", "scissors"];

export const CLIENT_MESSAGE_TYPES = {
  SELECT_MODE: "select_mode",
  CHOICE: "choice",
  REMATCH_READY: "rematch_ready",
  REMATCH_CANCEL: "rematch_cancel",
};

export const SERVER_MESSAGE_TYPES = {
  ERROR: "error",
};

export const JOIN_ERROR_CODES = {
  ROOM_FULL: "join.room_full",
  DUPLICATE_SESSION: "join.duplicate_session",
  INVALID_NICKNAME: "join.invalid_nickname",
};

export const ACTION_ERROR_CODES = {
  INVALID_STATE: "action.invalid_state",
  NOT_HOST: "action.not_host",
  INVALID_PAYLOAD: "action.invalid_payload",
  INVALID_MODE: "action.invalid_mode",
  INVALID_CHOICE: "action.invalid_choice",
  ALREADY_CHOSEN: "action.already_chosen",
};

export const TRANSPORT_ERROR_CODES = {
  CONNECTION_LOST: "transport.connection_lost",
  RECONNECT_EXPIRED: "transport.reconnect_expired",
  RECONNECT_REJECTED: "transport.reconnect_rejected",
};

export const NORMALIZED_ERROR_CODES = {
  ...JOIN_ERROR_CODES,
  ...ACTION_ERROR_CODES,
  ...TRANSPORT_ERROR_CODES,
};

export const RECONNECT_GRACE_SECONDS = 10;
export const RECONNECT_TOKEN_TTL_MS = RECONNECT_GRACE_SECONDS * 1000;
export const RECONNECT_STORAGE_KEY = "rps:reconnect:v1";
