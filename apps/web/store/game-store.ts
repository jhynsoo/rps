"use client";

import type { Room } from "colyseus.js";
import { create } from "zustand";
import {
  clearReconnectSnapshot,
  createReconnectSnapshot,
  persistReconnectSnapshot,
  readReconnectSnapshot,
  readReconnectSnapshotStatus,
  reconnectRoom,
} from "@/lib/colyseus-client";

type GameStoreState = {
  room: Room | null;
  roomId: string | null;
  leaveError: "errors.serverUnavailable" | null;
  reconnectState: "idle" | "trying" | "succeeded" | "failed";
  reconnectError: "expired" | "invalid" | "network" | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
  leaveRoom: () => Promise<void>;
  attemptReconnect: (roomId: string) => Promise<boolean>;
};

export const leaveErrorDisconnected = "errors.serverUnavailable" as const;
export type LeaveErrorAction =
  | "start-game"
  | "mode-select"
  | "choice-rock"
  | "choice-paper"
  | "choice-scissors"
  | "rematch-ready"
  | "back"
  | "leave"
  | "join-submit"
  | "go-lobby";

const leaveErrorBlockedActions = new Set<LeaveErrorAction>([
  "start-game",
  "mode-select",
  "choice-rock",
  "choice-paper",
  "choice-scissors",
  "rematch-ready",
]);

export function isActionBlockedByLeaveError(
  action: LeaveErrorAction,
  leaveError: "errors.serverUnavailable" | null,
): boolean {
  if (!leaveError) return false;
  return leaveErrorBlockedActions.has(action);
}

const leaveListenersAttached = new WeakSet<Room>();
const pageHideHandlers = new WeakMap<Room, () => void>();
const forceDisconnectHandlers = new WeakMap<Room, EventListener>();

export const useGameStore = create<GameStoreState>((set, get) => ({
  room: null,
  roomId: null,
  leaveError: null,
  reconnectState: "idle",
  reconnectError: null,
  setRoom: (room) => {
    set({ room, roomId: room.roomId, leaveError: null, reconnectError: null, reconnectState: "idle" });
    clearReconnectSnapshot();

    const initialSnapshot = createReconnectSnapshot(room);
    if (initialSnapshot) {
      persistReconnectSnapshot(initialSnapshot);
    }

    if (leaveListenersAttached.has(room)) return;
    leaveListenersAttached.add(room);

    if (typeof window !== "undefined") {
      const pageHideHandler = () => {
        void room.leave(false);
      };
      const forceDisconnectHandler: EventListener = () => {
        void room.leave(false);
      };

      pageHideHandlers.set(room, pageHideHandler);
      forceDisconnectHandlers.set(room, forceDisconnectHandler);
      window.addEventListener("pagehide", pageHideHandler, { once: true });
      window.addEventListener("rps:force-disconnect", forceDisconnectHandler);
    }

    room.onLeave(() => {
      if (typeof window !== "undefined") {
        const pageHideHandler = pageHideHandlers.get(room);
        const forceDisconnectHandler = forceDisconnectHandlers.get(room);
        if (pageHideHandler) {
          window.removeEventListener("pagehide", pageHideHandler);
          pageHideHandlers.delete(room);
        }
        if (forceDisconnectHandler) {
          window.removeEventListener("rps:force-disconnect", forceDisconnectHandler);
          forceDisconnectHandlers.delete(room);
        }
      }

      const snapshot = createReconnectSnapshot(room);
      if (snapshot) {
        persistReconnectSnapshot(snapshot);
      }

      set((s) => {
        if (s.room !== room) return s;
        return { ...s, leaveError: leaveErrorDisconnected };
      });
    });
  },
  clearRoom: () => {
    set({
      room: null,
      roomId: null,
      leaveError: null,
      reconnectState: "idle",
      reconnectError: null,
    });
  },
  leaveRoom: async () => {
    const current = get().room;
    if (typeof window !== "undefined" && current) {
      const pageHideHandler = pageHideHandlers.get(current);
      const forceDisconnectHandler = forceDisconnectHandlers.get(current);
      if (pageHideHandler) {
        window.removeEventListener("pagehide", pageHideHandler);
        pageHideHandlers.delete(current);
      }
      if (forceDisconnectHandler) {
        window.removeEventListener("rps:force-disconnect", forceDisconnectHandler);
        forceDisconnectHandlers.delete(current);
      }
    }
    clearReconnectSnapshot();
    set({
      room: null,
      roomId: null,
      leaveError: null,
      reconnectState: "idle",
      reconnectError: null,
    });
    if (current) await current.leave();
  },
  attemptReconnect: async (roomId) => {
    set({ reconnectState: "trying", reconnectError: null });

    const snapshotStatus = readReconnectSnapshotStatus(roomId);
    const snapshot = readReconnectSnapshot(roomId);
    if (!snapshot) {
      set({
        reconnectState: "failed",
        reconnectError: snapshotStatus === "expired" ? "expired" : null,
        leaveError: leaveErrorDisconnected,
        room: null,
        roomId: null,
      });
      return false;
    }

    try {
      const room = await reconnectRoom(snapshot.token);
      get().setRoom(room);

      const refreshedSnapshot = createReconnectSnapshot(room);
      if (refreshedSnapshot) {
        persistReconnectSnapshot(refreshedSnapshot);
      }

      set({ reconnectState: "succeeded", reconnectError: null });

      return true;
    } catch (error) {
      clearReconnectSnapshot();

      const message = error instanceof Error ? error.message : String(error);
      const reconnectError =
        /invalid|token|format/i.test(message)
          ? "invalid"
          : /expired|not found|no such/i.test(message)
            ? "expired"
            : "network";

      set({
        reconnectState: "failed",
        reconnectError,
        leaveError: leaveErrorDisconnected,
        room: null,
        roomId: null,
      });
      return false;
    }
  },
}));
