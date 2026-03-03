"use client";

import {
  RECONNECT_STORAGE_KEY,
  RECONNECT_TOKEN_TTL_MS,
  type ReconnectSnapshot,
} from "@rps/contracts";
import { Client, type Room } from "colyseus.js";

type NicknameOptions = {
  nickname: string;
};

export type ColyseusBoundary = "create" | "join" | "reconnect";

export type ColyseusBoundaryErrorCode =
  | "CLIENT_ONLY"
  | "SERVER_UNAVAILABLE"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "RECONNECT_TOKEN_INVALID"
  | "RECONNECT_TOKEN_EXPIRED"
  | "UNKNOWN";

export type ColyseusBoundaryError = {
  boundary: ColyseusBoundary;
  code: ColyseusBoundaryErrorCode;
  message: string;
  rawMessage: string;
  cause: unknown;
};

const DEFAULT_PORT = 2567;

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

export function normalizeColyseusError(
  error: unknown,
  boundary: ColyseusBoundary,
): ColyseusBoundaryError {
  if (isColyseusBoundaryError(error)) {
    return error;
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const message = rawMessage.trim();

  let code: ColyseusBoundaryErrorCode = "UNKNOWN";

  if (/window is undefined|must be called on the client|client side/i.test(message)) {
    code = "CLIENT_ONLY";
  } else if (
    /websocket|network|ECONNREFUSED|ENOTFOUND|timeout|timed out|failed to fetch|connect failed/i.test(
      message,
    )
  ) {
    code = "SERVER_UNAVAILABLE";
  } else if (boundary === "join") {
    if (/full|maxClients|seat|locked/i.test(message)) code = "ROOM_FULL";
    if (/not found|roomId|invalid|no such/i.test(message)) code = "ROOM_NOT_FOUND";
  } else if (boundary === "reconnect") {
    if (/invalid|format|malformed/i.test(message)) code = "RECONNECT_TOKEN_INVALID";
    else if (/expired|not found|no such/i.test(message)) code = "RECONNECT_TOKEN_EXPIRED";
  }

  return {
    boundary,
    code,
    message,
    rawMessage,
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
