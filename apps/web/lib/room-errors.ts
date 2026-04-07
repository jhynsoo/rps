import { find, pipe } from "@fxts/core";
import { JOIN_ERROR_CODES, TRANSPORT_ERROR_CODES } from "@rps/contracts";

import { normalizeColyseusError } from "@/lib/colyseus-client";
import { type CompatErrorCode, LEGACY_ERROR_CODES } from "@/lib/error-contract";

type ErrorKey =
  | "errors.createFailed"
  | "errors.joinFailed"
  | "errors.roomFull"
  | "errors.roomNotFound"
  | "errors.serverUnavailable";

type ErrorRule = {
  key: ErrorKey;
  matches: (code: CompatErrorCode) => boolean;
};

const createErrorRules: readonly ErrorRule[] = [
  {
    key: "errors.serverUnavailable",
    matches: (code) =>
      code === TRANSPORT_ERROR_CODES.CONNECTION_LOST ||
      code === LEGACY_ERROR_CODES.SERVER_UNAVAILABLE,
  },
] as const;

const joinErrorRules: readonly ErrorRule[] = [
  {
    key: "errors.roomFull",
    matches: (code) => code === JOIN_ERROR_CODES.ROOM_FULL || code === LEGACY_ERROR_CODES.ROOM_FULL,
  },
  {
    key: "errors.serverUnavailable",
    matches: (code) =>
      code === TRANSPORT_ERROR_CODES.CONNECTION_LOST ||
      code === LEGACY_ERROR_CODES.SERVER_UNAVAILABLE,
  },
  {
    key: "errors.roomNotFound",
    matches: (code) => code === LEGACY_ERROR_CODES.ROOM_NOT_FOUND,
  },
] as const;

function resolveErrorKey(
  code: CompatErrorCode,
  rules: readonly ErrorRule[],
  fallback: ErrorKey,
): ErrorKey {
  return pipe(
    rules,
    find((rule) => rule.matches(code)),
    (rule) => rule?.key ?? fallback,
  );
}

export function resolveCreateRoomErrorKey(error: unknown): ErrorKey {
  return resolveErrorKey(
    normalizeColyseusError(error, "create").code,
    createErrorRules,
    "errors.createFailed",
  );
}

export function resolveJoinRoomErrorKey(error: unknown): ErrorKey {
  return resolveErrorKey(
    normalizeColyseusError(error, "join").code,
    joinErrorRules,
    "errors.joinFailed",
  );
}
