const GAME_STATUSES = ["waiting", "mode_select", "choosing", "result", "finished"];

const GAME_MODES = ["single", "best_of_3", "best_of_5"];

const RPS_CHOICES = ["rock", "paper", "scissors"];

const CLIENT_MESSAGE_TYPES = {
  SELECT_MODE: "select_mode",
  CHOICE: "choice",
  REMATCH_READY: "rematch_ready",
  REMATCH_CANCEL: "rematch_cancel",
};

const RECONNECT_GRACE_SECONDS = 10;
const RECONNECT_TOKEN_TTL_MS = 600000;
const RECONNECT_STORAGE_KEY = "rps:reconnect:v1";

module.exports = {
  GAME_STATUSES,
  GAME_MODES,
  RPS_CHOICES,
  CLIENT_MESSAGE_TYPES,
  RECONNECT_GRACE_SECONDS,
  RECONNECT_TOKEN_TTL_MS,
  RECONNECT_STORAGE_KEY,
};
