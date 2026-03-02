"use client";

import { Client, type Room } from "colyseus.js";
import {
  RECONNECT_STORAGE_KEY,
  RECONNECT_TOKEN_TTL_MS,
  type ReconnectSnapshot,
} from "@rps/contracts";

type NicknameOptions = {
  nickname: string;
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
  const client = getClient();
  return client.create("my_room", { nickname });
}

export async function joinRoomById(roomId: string, { nickname }: NicknameOptions): Promise<Room> {
  const client = getClient();
  return client.joinById(roomId, { nickname });
}

export async function reconnectRoom(token: string): Promise<Room> {
  const client = getClient();
  return client.reconnect(token);
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
