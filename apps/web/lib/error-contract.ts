import {
  ACTION_ERROR_CODES,
  type ErrorCode as ContractErrorCode,
  type ErrorEnvelope as ContractErrorEnvelope,
  type ErrorBoundary,
  JOIN_ERROR_CODES,
  NORMALIZED_ERROR_CODES,
  TRANSPORT_ERROR_CODES,
} from "@rps/contracts";

export const LEGACY_ERROR_CODES = {
  CLIENT_ONLY: "CLIENT_ONLY",
  SERVER_UNAVAILABLE: "SERVER_UNAVAILABLE",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  RECONNECT_TOKEN_INVALID: "RECONNECT_TOKEN_INVALID",
  RECONNECT_TOKEN_EXPIRED: "RECONNECT_TOKEN_EXPIRED",
} as const;

export const WEB_COMPAT_ERROR_CODES = {
  UNKNOWN: "unknown",
} as const;

export type LegacyErrorCode = (typeof LEGACY_ERROR_CODES)[keyof typeof LEGACY_ERROR_CODES];
export type CompatErrorCode =
  | ContractErrorCode
  | LegacyErrorCode
  | typeof WEB_COMPAT_ERROR_CODES.UNKNOWN;

export type ErrorEnvelope = Omit<ContractErrorEnvelope, "code"> & {
  code: CompatErrorCode;
  rawCode?: number | null;
  rawMessage?: string;
};

const contractErrorCodeSet = new Set<string>(Object.values(NORMALIZED_ERROR_CODES));
const actionErrorCodeSet = new Set<string>(Object.values(ACTION_ERROR_CODES));

export function isContractErrorCode(code: unknown): code is ContractErrorCode {
  return typeof code === "string" && contractErrorCodeSet.has(code);
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<ErrorEnvelope>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.boundary === "string"
  );
}

function coerceBoundary(value: unknown): ErrorBoundary {
  if (value === "join" || value === "action" || value === "transport") return value;
  return "transport";
}

export function coerceErrorEnvelope(payload: unknown): ErrorEnvelope {
  if (isErrorEnvelope(payload)) {
    return payload;
  }

  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const message =
    typeof record.message === "string" && record.message.length > 0
      ? record.message
      : String(payload ?? "");

  const rawCode =
    typeof record.rawCode === "number"
      ? record.rawCode
      : typeof record.code === "number"
        ? record.code
        : null;

  const codeCandidate = typeof record.code === "string" ? record.code : null;

  return {
    boundary: coerceBoundary(record.boundary),
    code: isContractErrorCode(codeCandidate) ? codeCandidate : WEB_COMPAT_ERROR_CODES.UNKNOWN,
    message,
    rawCode,
    rawMessage: message,
  };
}

export function resolveContractErrorMessageKey(
  code: CompatErrorCode,
):
  | "errors.roomFull"
  | "errors.serverUnavailable"
  | "errors.reconnectExpired"
  | "errors.reconnectInvalid"
  | "errors.actionRejected"
  | "errors.joinUnavailable" {
  if (code === JOIN_ERROR_CODES.ROOM_FULL || code === LEGACY_ERROR_CODES.ROOM_FULL) {
    return "errors.roomFull";
  }

  if (
    code === TRANSPORT_ERROR_CODES.CONNECTION_LOST ||
    code === LEGACY_ERROR_CODES.SERVER_UNAVAILABLE ||
    code === LEGACY_ERROR_CODES.CLIENT_ONLY
  ) {
    return "errors.serverUnavailable";
  }

  if (
    code === TRANSPORT_ERROR_CODES.RECONNECT_EXPIRED ||
    code === LEGACY_ERROR_CODES.RECONNECT_TOKEN_EXPIRED
  ) {
    return "errors.reconnectExpired";
  }

  if (
    code === TRANSPORT_ERROR_CODES.RECONNECT_REJECTED ||
    code === LEGACY_ERROR_CODES.RECONNECT_TOKEN_INVALID
  ) {
    return "errors.reconnectInvalid";
  }

  if (typeof code === "string" && actionErrorCodeSet.has(code)) {
    return "errors.actionRejected";
  }

  return "errors.joinUnavailable";
}
