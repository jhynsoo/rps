"use client";

import type { Room } from "colyseus.js";
import { create } from "zustand";

type GameStoreState = {
  room: Room | null;
  roomId: string | null;
  leaveError: "errors.serverUnavailable" | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
  leaveRoom: () => Promise<void>;
};

export const leaveErrorDisconnected = "errors.serverUnavailable" as const;

const leaveListenersAttached = new WeakSet<Room>();

export const useGameStore = create<GameStoreState>((set, get) => ({
  room: null,
  roomId: null,
  leaveError: null,
  setRoom: (room) => {
    set({ room, roomId: room.roomId, leaveError: null });

    if (leaveListenersAttached.has(room)) return;
    leaveListenersAttached.add(room);

    room.onLeave(() => {
      set((s) => {
        if (s.room !== room) return s;
        return { ...s, leaveError: leaveErrorDisconnected };
      });
    });
  },
  clearRoom: () => {
    set({ room: null, roomId: null, leaveError: null });
  },
  leaveRoom: async () => {
    const current = get().room;
    set({ room: null, roomId: null, leaveError: null });
    if (current) await current.leave();
  },
}));
