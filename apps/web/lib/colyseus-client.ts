"use client";

import { Client, type Room } from "colyseus.js";

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
