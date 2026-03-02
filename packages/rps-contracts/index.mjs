export const GAME_STATUSES = ["waiting", "mode_select", "choosing", "result", "finished"];

export const GAME_MODES = ["single", "best_of_3", "best_of_5"];

export const RPS_CHOICES = ["rock", "paper", "scissors"];

export const CLIENT_MESSAGE_TYPES = {
  SELECT_MODE: "select_mode",
  CHOICE: "choice",
  REMATCH_READY: "rematch_ready",
  REMATCH_CANCEL: "rematch_cancel",
};

export const RECONNECT_GRACE_SECONDS = 10;
export const RECONNECT_TOKEN_TTL_MS = 600000;
export const RECONNECT_STORAGE_KEY = "rps:reconnect:v1";
