"use client";

import {
  JOIN_ERROR_CODES,
  RECONNECT_STORAGE_KEY,
  RECONNECT_TOKEN_TTL_MS,
  TRANSPORT_ERROR_CODES,
  type ReconnectSnapshot,
} from "@rps/contracts";
import { Client, type Room } from "colyseus.js";

import {
  LEGACY_ERROR_CODES,
  WEB_COMPAT_ERROR_CODES,
  type CompatErrorCode,
  type ErrorEnvelope,
} from "@/lib/error-contract";

type NicknameOptions = {
  nickname: string;
};

export type ColyseusBoundary = "create" | "join" | "reconnect";

export type ColyseusBoundaryErrorCode = CompatErrorCode;

export type ColyseusBoundaryError = Omit<ErrorEnvelope, "boundary"> & {
  boundary: ColyseusBoundary;
  rawMessage: string;
  cause: unknown;
};

const DEFAULT_PORT = 2567;
const SERVER_UNAVAILABLE_HINTS = [
  "websocket",
  "network",
  "econnrefused",
  "enotfound",
  "timeout",
  "timed out",
  "failed to fetch",
  "connect failed",
];

let clientSingleton: Client | null = null;

function assertClientSide() {
  if (typeof window === "undefined") {
    throw new Error(
      "colyseus-client: create/join must be called on the client (window is undefined).",
    );
  }
}

function getEndpoint() {
  const fromEnv = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostname = window.location.hostname || "127.0.0.1";
    return `${wsProtocol}://${hostname}:${DEFAULT_PORT}`;
  }

  return `ws://127.0.0.1:${DEFAULT_PORT}`;
}

function getClient() {
  assertClientSide();

  if (!clientSingleton) {
    clientSingleton = new Client(getEndpoint());
  }

  return clientSingleton;
}

export async function createRoom({ nickname }: NicknameOptions): Promise<Room> {
  try {
    const client = getClient();
    return await client.create("my_room", { nickname });
  } catch (error) {
    throw normalizeColyseusError(error, "create");
  }
}

export async function joinRoomById(roomId: string, { nickname }: NicknameOptions): Promise<Room> {
  try {
    const client = getClient();
    return await client.joinById(roomId, { nickname });
  } catch (error) {
    throw normalizeColyseusError(error, "join");
  }
}

export async function reconnectRoom(token: string): Promise<Room> {
  try {
    const client = getClient();
    return await client.reconnect(token);
  } catch (error) {
    throw normalizeColyseusError(error, "reconnect");
  }
}

type ErrorParts = {
  rawCode: number | null;
  rawMessage: string;
  normalizedMessage: string;
};

function hasHint(message: string, hints: readonly string[]) {
  return hints.some((hint) => message.includes(hint));
}

function readErrorParts(error: unknown): ErrorParts {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const codeFromNumber = typeof record.code === "number" ? record.code : null;
  const codeFromString =
    typeof record.code === "string" && /^\d+$/.test(record.code.trim())
      ? Number(record.code)
      : null;

  const rawCode = codeFromNumber ?? codeFromString;

  const rawMessage =
    typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : String(error ?? "");

  return {
    rawCode,
    rawMessage,
    normalizedMessage: rawMessage.trim().toLowerCase(),
  };
}

function mapDeterministicErrorCode(
  boundary: ColyseusBoundary,
  parts: ErrorParts,
): CompatErrorCode | null {
  if (parts.normalizedMessage.includes("window is undefined")) {
    return LEGACY_ERROR_CODES.CLIENT_ONLY;
  }

  if (hasHint(parts.normalizedMessage, SERVER_UNAVAILABLE_HINTS)) {
    return TRANSPORT_ERROR_CODES.CONNECTION_LOST;
  }

  if (boundary === "join" && parts.rawCode === 4212) {
    const hasNotFound = parts.normalizedMessage.includes("not found");
    const hasLocked = parts.normalizedMessage.includes("locked");

    if (hasNotFound && !hasLocked) return LEGACY_ERROR_CODES.ROOM_NOT_FOUND;
    if (hasLocked && !hasNotFound) return LEGACY_ERROR_CODES.ROOM_NOT_FOUND;

    return WEB_COMPAT_ERROR_CODES.UNKNOWN;
  }

  if (boundary === "join" && parts.rawCode === 4213) {
    return JOIN_ERROR_CODES.ROOM_FULL;
  }

  if (boundary === "reconnect" && parts.rawCode === 4214) {
    return TRANSPORT_ERROR_CODES.RECONNECT_EXPIRED;
  }

  // Legacy textual fallbacks for compatibility with non-coded errors.
  if (boundary === "join") {
    if (parts.normalizedMessage.includes("maxclients") || parts.normalizedMessage.includes("full")) {
      return LEGACY_ERROR_CODES.ROOM_FULL;
    }
    if (parts.normalizedMessage.includes("not found")) {
      return LEGACY_ERROR_CODES.ROOM_NOT_FOUND;
    }
  }

  if (boundary === "reconnect") {
    if (parts.normalizedMessage.includes("expired")) {
      return LEGACY_ERROR_CODES.RECONNECT_TOKEN_EXPIRED;
    }
    if (parts.normalizedMessage.includes("invalid") || parts.normalizedMessage.includes("malformed")) {
      return LEGACY_ERROR_CODES.RECONNECT_TOKEN_INVALID;
    }
  }

  return null;
}

export function normalizeColyseusError(
  error: unknown,
  boundary: ColyseusBoundary,
): ColyseusBoundaryError {
  if (isColyseusBoundaryError(error)) {
    return error;
  }

  const parts = readErrorParts(error);
  const code = mapDeterministicErrorCode(boundary, parts) ?? WEB_COMPAT_ERROR_CODES.UNKNOWN;

  return {
    boundary,
    code,
    message: parts.rawMessage,
    rawMessage: parts.rawMessage,
    rawCode: parts.rawCode,
    cause: error,
  };
}

export function isColyseusBoundaryError(error: unknown): error is ColyseusBoundaryError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Partial<ColyseusBoundaryError>;
  return (
    typeof candidate.boundary === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.rawMessage === "string"
  );
}

function isReconnectSnapshot(value: unknown): value is ReconnectSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.roomId === "string" &&
    typeof item.token === "string" &&
    typeof item.expiresAt === "number"
  );
}

export function persistReconnectSnapshot(snapshot: ReconnectSnapshot): void {
  assertClientSide();
  window.localStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function readReconnectSnapshotStatus(
  roomId: string,
): "missing" | "invalid" | "expired" | "mismatch" | "ok" {
  assertClientSide();
  const raw = window.localStorage.getItem(RECONNECT_STORAGE_KEY);
  if (!raw) return "missing";

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isReconnectSnapshot(parsed)) {
      window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
      return "invalid";
    }

    if (parsed.roomId !== roomId) {
      window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
      return "mismatch";
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
      return "expired";
    }

    return "ok";
  } catch {
    window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
    return "invalid";
  }
}

export function readReconnectSnapshot(roomId: string): ReconnectSnapshot | null {
  assertClientSide();
  if (readReconnectSnapshotStatus(roomId) !== "ok") return null;
  const raw = window.localStorage.getItem(RECONNECT_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as ReconnectSnapshot;
}

export function createReconnectSnapshot(room: Room): ReconnectSnapshot | null {
  if (typeof room.reconnectionToken !== "string" || room.reconnectionToken.length === 0) {
    return null;
  }

  return {
    roomId: room.roomId,
    token: room.reconnectionToken,
    expiresAt: Date.now() + RECONNECT_TOKEN_TTL_MS,
  };
}

export function clearReconnectSnapshot(): void {
  assertClientSide();
  window.localStorage.removeItem(RECONNECT_STORAGE_KEY);
}
