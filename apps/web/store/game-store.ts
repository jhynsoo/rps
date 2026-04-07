"use client";

import { SERVER_MESSAGE_TYPES, TRANSPORT_ERROR_CODES } from "@rps/contracts";
import type { Room } from "colyseus.js";
import { create, type StoreApi } from "zustand";
import {
  clearReconnectSnapshot,
  createReconnectSnapshot,
  normalizeColyseusError,
  persistReconnectSnapshot,
  readReconnectSnapshot,
  readReconnectSnapshotStatus,
  reconnectRoom,
} from "@/lib/colyseus-client";
import {
  coerceErrorEnvelope,
  type ErrorEnvelope,
  WEB_COMPAT_ERROR_CODES,
} from "@/lib/error-contract";
import { safeLeave } from "@/lib/safe-leave";

type GameStoreState = {
  room: Room | null;
  roomId: string | null;
  leaveError: "errors.serverUnavailable" | null;
  reconnectState: "idle" | "trying" | "succeeded" | "failed";
  reconnectError: "expired" | "invalid" | "network" | null;
  lastErrorEnvelope: ErrorEnvelope | null;
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

type BaseRoomState = Pick<
  GameStoreState,
  "room" | "roomId" | "leaveError" | "reconnectState" | "reconnectError" | "lastErrorEnvelope"
>;

const idleRoomState = (): BaseRoomState => ({
  room: null,
  roomId: null,
  leaveError: null,
  reconnectState: "idle",
  reconnectError: null,
  lastErrorEnvelope: null,
});

const attachedRoomState = (room: Room): BaseRoomState => ({
  room,
  roomId: room.roomId,
  leaveError: null,
  reconnectState: "idle",
  reconnectError: null,
  lastErrorEnvelope: null,
});

function persistSnapshotForRoom(room: Room) {
  const snapshot = createReconnectSnapshot(room);
  if (snapshot) {
    persistReconnectSnapshot(snapshot);
  }
}

function setLastErrorEnvelopeForRoom(
  set: StoreApi<GameStoreState>["setState"],
  room: Room,
  envelope: ErrorEnvelope,
) {
  set((state) => {
    if (state.room !== room) return state;
    return { ...state, lastErrorEnvelope: envelope };
  });
}

function resolveTransportErrorCode(rawCode: number): ErrorEnvelope["code"] {
  if (rawCode === 4214) {
    return TRANSPORT_ERROR_CODES.RECONNECT_EXPIRED;
  }

  return WEB_COMPAT_ERROR_CODES.UNKNOWN;
}

function buildTransportErrorEnvelope(code: number, message: string | undefined): ErrorEnvelope {
  const normalizedMessage = message ?? "";

  return {
    boundary: "transport",
    code: resolveTransportErrorCode(code),
    message: normalizedMessage,
    rawCode: code,
    rawMessage: normalizedMessage,
  };
}

function detachWindowLeaveHandlers(room: Room | null) {
  if (typeof window === "undefined" || !room) return;

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

function attachWindowLeaveHandlers(room: Room) {
  if (typeof window === "undefined") return;

  const pageHideHandler = () => {
    void safeLeave(room, false);
  };
  const forceDisconnectHandler: EventListener = () => {
    void safeLeave(room, false);
  };

  pageHideHandlers.set(room, pageHideHandler);
  forceDisconnectHandlers.set(room, forceDisconnectHandler);
  window.addEventListener("pagehide", pageHideHandler, { once: true });
  window.addEventListener("rps:force-disconnect", forceDisconnectHandler);
}

function resolveReconnectFailureState(
  reconnectError: GameStoreState["reconnectError"],
): Partial<GameStoreState> {
  return {
    reconnectState: "failed",
    reconnectError,
    leaveError: leaveErrorDisconnected,
    room: null,
    roomId: null,
  };
}

function resolveReconnectError(
  status: ReturnType<typeof readReconnectSnapshotStatus>,
  normalizedCode?: ErrorEnvelope["code"],
): GameStoreState["reconnectError"] {
  if (status === "expired" || normalizedCode === TRANSPORT_ERROR_CODES.RECONNECT_EXPIRED) {
    return "expired";
  }

  return normalizedCode ? "network" : null;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...idleRoomState(),
  setRoom: (room) => {
    set(attachedRoomState(room));
    clearReconnectSnapshot();
    persistSnapshotForRoom(room);

    if (leaveListenersAttached.has(room)) return;
    leaveListenersAttached.add(room);

    room.onMessage(SERVER_MESSAGE_TYPES.ERROR, (payload: unknown) => {
      setLastErrorEnvelopeForRoom(set, room, coerceErrorEnvelope(payload));
    });

    room.onError((code, message) => {
      setLastErrorEnvelopeForRoom(set, room, buildTransportErrorEnvelope(code, message));
    });

    attachWindowLeaveHandlers(room);

    room.onLeave(() => {
      detachWindowLeaveHandlers(room);
      persistSnapshotForRoom(room);

      set((s) => {
        if (s.room !== room) return s;
        return { ...s, leaveError: leaveErrorDisconnected };
      });
    });
  },
  clearRoom: () => {
    set(idleRoomState());
  },
  leaveRoom: async () => {
    const current = get().room;
    detachWindowLeaveHandlers(current);
    clearReconnectSnapshot();
    set(idleRoomState());
    await safeLeave(current);
  },
  attemptReconnect: async (roomId) => {
    set({ reconnectState: "trying", reconnectError: null });

    const snapshotStatus = readReconnectSnapshotStatus(roomId);
    const snapshot = readReconnectSnapshot(roomId);
    if (!snapshot) {
      set(resolveReconnectFailureState(resolveReconnectError(snapshotStatus)));
      return false;
    }

    try {
      const room = await reconnectRoom(snapshot.token);
      get().setRoom(room);

      persistSnapshotForRoom(room);

      set({ reconnectState: "succeeded", reconnectError: null });

      return true;
    } catch (error) {
      clearReconnectSnapshot();
      const normalized = normalizeColyseusError(error, "reconnect");
      set(resolveReconnectFailureState(resolveReconnectError("ok", normalized.code)));
      return false;
    }
  },
}));
