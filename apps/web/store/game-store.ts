"use client";

import type { Room } from "colyseus.js";
import { create } from "zustand";

type GameStoreState = {
  room: Room | null;
  roomId: string | null;
  roomVersion: number;
  leaveError: string | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
  leaveRoom: () => Promise<void>;
};

const listenersAttached = new WeakSet<Room>();

export const useGameStore = create<GameStoreState>((set, get) => ({
  room: null,
  roomId: null,
  roomVersion: 0,
  leaveError: null,
  setRoom: (room) => {
    set({ room, roomId: room.roomId, roomVersion: 0, leaveError: null });

    if (listenersAttached.has(room)) return;
    listenersAttached.add(room);

    room.onStateChange(() => {
      set((s) => {
        if (s.room !== room) return s;
        return { ...s, roomVersion: s.roomVersion + 1 };
      });
    });

    room.onLeave(() => {
      set((s) => {
        if (s.room !== room) return s;
        return { ...s, leaveError: "Disconnected from server." };
      });
    });
  },
  clearRoom: () => {
    set({ room: null, roomId: null, roomVersion: 0, leaveError: null });
  },
  leaveRoom: async () => {
    const current = get().room;
    set({ room: null, roomId: null, roomVersion: 0, leaveError: null });
    if (current) await current.leave();
  },
}));
