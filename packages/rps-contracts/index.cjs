const GAME_STATUSES = ["waiting", "mode_select", "choosing", "result", "finished"];

const GAME_MODES = ["single", "best_of_3", "best_of_5"];

const RPS_CHOICES = ["rock", "paper", "scissors"];

const CLIENT_MESSAGE_TYPES = {
  SELECT_MODE: "select_mode",
  CHOICE: "choice",
  REMATCH_READY: "rematch_ready",
  REMATCH_CANCEL: "rematch_cancel",
};

const JOIN_ERROR_CODES = {
  ROOM_FULL: "join.room_full",
  DUPLICATE_SESSION: "join.duplicate_session",
  INVALID_NICKNAME: "join.invalid_nickname",
};

const ACTION_ERROR_CODES = {
  INVALID_STATE: "action.invalid_state",
  NOT_HOST: "action.not_host",
  INVALID_PAYLOAD: "action.invalid_payload",
  INVALID_MODE: "action.invalid_mode",
  INVALID_CHOICE: "action.invalid_choice",
  ALREADY_CHOSEN: "action.already_chosen",
};

const TRANSPORT_ERROR_CODES = {
  CONNECTION_LOST: "transport.connection_lost",
  RECONNECT_EXPIRED: "transport.reconnect_expired",
  RECONNECT_REJECTED: "transport.reconnect_rejected",
};

const NORMALIZED_ERROR_CODES = {
  ...JOIN_ERROR_CODES,
  ...ACTION_ERROR_CODES,
  ...TRANSPORT_ERROR_CODES,
};

const RECONNECT_GRACE_SECONDS = 10;
const RECONNECT_TOKEN_TTL_MS = 600000;
const RECONNECT_STORAGE_KEY = "rps:reconnect:v1";

module.exports = {
  GAME_STATUSES,
  GAME_MODES,
  RPS_CHOICES,
  CLIENT_MESSAGE_TYPES,
  JOIN_ERROR_CODES,
  ACTION_ERROR_CODES,
  TRANSPORT_ERROR_CODES,
  NORMALIZED_ERROR_CODES,
  RECONNECT_GRACE_SECONDS,
  RECONNECT_TOKEN_TTL_MS,
  RECONNECT_STORAGE_KEY,
};
