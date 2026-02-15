"use client";

import { Client, type Room } from "colyseus.js";

type NicknameOptions = {
  nickname: string;
};

let clientSingleton: Client | null = null;

function assertClientSide() {
  if (typeof window === "undefined") {
    throw new Error(
      "colyseus-client: create/join must be called on the client (window is undefined).",
    );
  }
}

function getEndpoint() {
  return process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";
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

export async function joinRoomById(
  roomId: string,
  { nickname }: NicknameOptions,
): Promise<Room> {
  const client = getClient();
  return client.joinById(roomId, { nickname });
}
