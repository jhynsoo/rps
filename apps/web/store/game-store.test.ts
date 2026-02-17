import type { Room } from "colyseus.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaveErrorDisconnected, useGameStore } from "@/store/game-store";

type RoomCallback = () => void;

function createMockRoom(roomId: string) {
  let stateChangeCallback: RoomCallback | null = null;
  let leaveCallback: RoomCallback | null = null;

  return {
    room: {
      roomId,
      onStateChange: (callback: RoomCallback) => {
        stateChangeCallback = callback;
      },
      onLeave: (callback: RoomCallback) => {
        leaveCallback = callback;
      },
      leave: vi.fn(async () => {}),
    } as unknown as Room,
    emitStateChange: () => {
      stateChangeCallback?.();
    },
    emitLeave: () => {
      leaveCallback?.();
    },
  };
}

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.getState().clearRoom();
  });

  it("sets roomId and increments roomVersion on state changes", () => {
    const mockRoom = createMockRoom("room-123");

    useGameStore.getState().setRoom(mockRoom.room);
    expect(useGameStore.getState().roomId).toBe("room-123");
    expect(useGameStore.getState().roomVersion).toBe(0);

    mockRoom.emitStateChange();
    expect(useGameStore.getState().roomVersion).toBe(1);
  });

  it("stores leaveError when room leave callback fires", () => {
    const mockRoom = createMockRoom("room-456");

    useGameStore.getState().setRoom(mockRoom.room);
    mockRoom.emitLeave();

    expect(useGameStore.getState().leaveError).toBe(leaveErrorDisconnected);
  });
});
