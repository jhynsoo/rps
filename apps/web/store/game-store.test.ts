import type { Room } from "colyseus.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  isActionBlockedByLeaveError,
  type LeaveErrorAction,
  leaveErrorDisconnected,
  useGameStore,
} from "@/store/game-store";

vi.mock("@/lib/colyseus-client", () => ({
  clearReconnectSnapshot: vi.fn(),
  createReconnectSnapshot: vi.fn(),
  normalizeColyseusError: vi.fn((error: unknown) => ({
    boundary: "reconnect",
    code:
      error instanceof Error && /invalid/i.test(error.message)
        ? "RECONNECT_TOKEN_INVALID"
        : "UNKNOWN",
    message: error instanceof Error ? error.message : String(error ?? ""),
    rawMessage: error instanceof Error ? error.message : String(error ?? ""),
    cause: error,
  })),
  persistReconnectSnapshot: vi.fn(),
  readReconnectSnapshot: vi.fn(),
  readReconnectSnapshotStatus: vi.fn(),
  reconnectRoom: vi.fn(),
}));

type RoomCallback = () => void;

function createMockRoom(roomId: string, reconnectionToken?: string) {
  let leaveCallback: RoomCallback | null = null;

  const room = {
    roomId,
    sessionId: `${roomId}-session`,
    reconnectionToken,
    onLeave: (callback: RoomCallback) => {
      leaveCallback = callback;
    },
    leave: vi.fn(async () => {}),
  } as unknown as Room;

  return {
    room,
    emitLeave: () => {
      leaveCallback?.();
    },
  };
}

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState({
      room: null,
      roomId: null,
      leaveError: null,
      reconnectState: "idle",
      reconnectError: null,
    });

    vi.clearAllMocks();
  });

  it("sets roomId when room is attached", () => {
    const mockRoom = createMockRoom("room-123");

    useGameStore.getState().setRoom(mockRoom.room);

    expect(useGameStore.getState().roomId).toBe("room-123");
    expect(useGameStore.getState().room).toBe(mockRoom.room);
  });

  it("persists reconnect snapshot and sets leaveError on room leave", () => {
    const mockRoom = createMockRoom("room-456", "room-456:token");
    const snapshot = {
      roomId: "room-456",
      token: "room-456:token",
      expiresAt: Date.now() + 600000,
    };

    vi.mocked(createReconnectSnapshot).mockReturnValue(snapshot);

    useGameStore.getState().setRoom(mockRoom.room);
    mockRoom.emitLeave();

    expect(persistReconnectSnapshot).toHaveBeenCalledWith(snapshot);
    expect(useGameStore.getState().leaveError).toBe(leaveErrorDisconnected);
  });

  it("leaveRoom clears reconnect snapshot and resets state", async () => {
    const mockRoom = createMockRoom("room-789");

    useGameStore.getState().setRoom(mockRoom.room);
    await useGameStore.getState().leaveRoom();

    expect(clearReconnectSnapshot).toHaveBeenCalledTimes(2);
    expect(mockRoom.room.leave).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().room).toBeNull();
    expect(useGameStore.getState().roomId).toBeNull();
    expect(useGameStore.getState().leaveError).toBeNull();
  });

  it("attemptReconnect succeeds and refreshes snapshot", async () => {
    const reconnectingRoom = createMockRoom("room-reconnect", "room-reconnect:new-token");
    const beforeSnapshot = {
      roomId: "room-reconnect",
      token: "room-reconnect:old-token",
      expiresAt: Date.now() + 600000,
    };
    const refreshedSnapshot = {
      roomId: "room-reconnect",
      token: "room-reconnect:new-token",
      expiresAt: Date.now() + 600000,
    };

    vi.mocked(readReconnectSnapshotStatus).mockReturnValue("ok");
    vi.mocked(readReconnectSnapshot).mockReturnValue(beforeSnapshot);
    vi.mocked(reconnectRoom).mockResolvedValue(reconnectingRoom.room);
    vi.mocked(createReconnectSnapshot).mockReturnValue(refreshedSnapshot);

    const result = await useGameStore.getState().attemptReconnect("room-reconnect");

    expect(result).toBe(true);
    expect(useGameStore.getState().room).toBe(reconnectingRoom.room);
    expect(useGameStore.getState().roomId).toBe("room-reconnect");
    expect(useGameStore.getState().leaveError).toBeNull();
    expect(useGameStore.getState().reconnectState).toBe("succeeded");
    expect(useGameStore.getState().reconnectError).toBeNull();
    expect(persistReconnectSnapshot).toHaveBeenCalledWith(refreshedSnapshot);
  });

  it("attemptReconnect does not retry expired snapshot", async () => {
    vi.mocked(readReconnectSnapshotStatus).mockReturnValue("expired");
    vi.mocked(readReconnectSnapshot).mockReturnValue(null);

    const result = await useGameStore.getState().attemptReconnect("room-expired");

    expect(result).toBe(false);
    expect(reconnectRoom).not.toHaveBeenCalled();
    expect(useGameStore.getState().reconnectState).toBe("failed");
    expect(useGameStore.getState().reconnectError).toBe("expired");
    expect(useGameStore.getState().leaveError).toBe(leaveErrorDisconnected);
  });

  it("attemptReconnect marks invalid token errors", async () => {
    vi.mocked(readReconnectSnapshotStatus).mockReturnValue("ok");
    vi.mocked(readReconnectSnapshot).mockReturnValue({
      roomId: "room-invalid",
      token: "room-invalid:bad",
      expiresAt: Date.now() + 600000,
    });
    vi.mocked(reconnectRoom).mockRejectedValue(new Error("Invalid reconnection token format"));
    vi.mocked(normalizeColyseusError).mockReturnValue({
      boundary: "reconnect",
      code: "RECONNECT_TOKEN_INVALID",
      message: "Invalid reconnection token format",
      rawMessage: "Invalid reconnection token format",
      cause: new Error("Invalid reconnection token format"),
    });

    const result = await useGameStore.getState().attemptReconnect("room-invalid");

    expect(result).toBe(false);
    expect(useGameStore.getState().reconnectState).toBe("failed");
    expect(useGameStore.getState().reconnectError).toBe("invalid");
    expect(clearReconnectSnapshot).toHaveBeenCalledTimes(1);
  });

  it("attemptReconnect marks network errors", async () => {
    vi.mocked(readReconnectSnapshotStatus).mockReturnValue("ok");
    vi.mocked(readReconnectSnapshot).mockReturnValue({
      roomId: "room-network",
      token: "room-network:token",
      expiresAt: Date.now() + 600000,
    });
    vi.mocked(reconnectRoom).mockRejectedValue(new Error("ECONNREFUSED"));
    vi.mocked(normalizeColyseusError).mockReturnValue({
      boundary: "reconnect",
      code: "SERVER_UNAVAILABLE",
      message: "ECONNREFUSED",
      rawMessage: "ECONNREFUSED",
      cause: new Error("ECONNREFUSED"),
    });

    const result = await useGameStore.getState().attemptReconnect("room-network");

    expect(result).toBe(false);
    expect(useGameStore.getState().reconnectState).toBe("failed");
    expect(useGameStore.getState().reconnectError).toBe("network");
  });
});

describe("isActionBlockedByLeaveError", () => {
  const blocked: LeaveErrorAction[] = [
    "start-game",
    "mode-select",
    "choice-rock",
    "choice-paper",
    "choice-scissors",
    "rematch-ready",
  ];

  const allowed: LeaveErrorAction[] = ["back", "leave", "join-submit", "go-lobby"];

  it("never blocks any action when leaveError is null", () => {
    for (const action of [...blocked, ...allowed]) {
      expect(isActionBlockedByLeaveError(action, null)).toBe(false);
    }
  });

  it("blocks only realtime actions when leaveError exists", () => {
    for (const action of blocked) {
      expect(isActionBlockedByLeaveError(action, leaveErrorDisconnected)).toBe(true);
    }

    for (const action of allowed) {
      expect(isActionBlockedByLeaveError(action, leaveErrorDisconnected)).toBe(false);
    }
  });
});
