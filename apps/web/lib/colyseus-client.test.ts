import { JOIN_ERROR_CODES, RECONNECT_STORAGE_KEY, TRANSPORT_ERROR_CODES } from "@rps/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReconnectSnapshot,
  normalizeColyseusError,
  persistReconnectSnapshot,
  readReconnectSnapshot,
  readReconnectSnapshotStatus,
} from "@/lib/colyseus-client";
import { LEGACY_ERROR_CODES, WEB_COMPAT_ERROR_CODES } from "@/lib/error-contract";

describe("normalizeColyseusError", () => {
  it("maps 4212 + not found to legacy ROOM_NOT_FOUND", () => {
    const normalized = normalizeColyseusError(
      { code: 4212, message: "matchmake error: room not found" },
      "join",
    );

    expect(normalized.code).toBe(LEGACY_ERROR_CODES.ROOM_NOT_FOUND);
  });

  it("maps 4212 + locked to legacy ROOM_NOT_FOUND", () => {
    const normalized = normalizeColyseusError(
      { code: 4212, message: "matchmake error: room is locked" },
      "join",
    );

    expect(normalized.code).toBe(LEGACY_ERROR_CODES.ROOM_NOT_FOUND);
  });

  it("maps ambiguous 4212 to unknown compatibility code", () => {
    const normalized = normalizeColyseusError({ code: 4212, message: "matchmake error" }, "join");

    expect(normalized.code).toBe(WEB_COMPAT_ERROR_CODES.UNKNOWN);
  });

  it("maps 4213 to join.room_full", () => {
    const normalized = normalizeColyseusError({ code: 4213, message: "already full" }, "join");

    expect(normalized.code).toBe(JOIN_ERROR_CODES.ROOM_FULL);
  });

  it("maps 4214 to transport.reconnect_expired", () => {
    const normalized = normalizeColyseusError(
      { code: 4214, message: "reconnection token expired" },
      "reconnect",
    );

    expect(normalized.code).toBe(TRANSPORT_ERROR_CODES.RECONNECT_EXPIRED);
  });

  it("maps network failures for create/join/reconnect", () => {
    expect(normalizeColyseusError(new Error("ECONNREFUSED"), "create").code).toBe(
      TRANSPORT_ERROR_CODES.CONNECTION_LOST,
    );
    expect(normalizeColyseusError(new Error("timeout"), "join").code).toBe(
      TRANSPORT_ERROR_CODES.CONNECTION_LOST,
    );
    expect(normalizeColyseusError(new Error("websocket closed"), "reconnect").code).toBe(
      TRANSPORT_ERROR_CODES.CONNECTION_LOST,
    );
  });

  it("returns unknown for unmatched errors", () => {
    const normalized = normalizeColyseusError(new Error("unexpected failure"), "create");
    expect(normalized.code).toBe(WEB_COMPAT_ERROR_CODES.UNKNOWN);
  });
});

describe("reconnect snapshot storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("stores reconnect snapshots in sessionStorage instead of localStorage", () => {
    const snapshot = {
      roomId: "room-secure",
      token: "room-secure:token",
      expiresAt: Date.now() + 1000,
    };

    persistReconnectSnapshot(snapshot);

    expect(window.sessionStorage.getItem(RECONNECT_STORAGE_KEY)).toBe(JSON.stringify(snapshot));
    expect(window.localStorage.getItem(RECONNECT_STORAGE_KEY)).toBeNull();
    expect(readReconnectSnapshot("room-secure")).toEqual(snapshot);
  });

  it("clears invalid reconnect snapshots from sessionStorage", () => {
    window.sessionStorage.setItem(RECONNECT_STORAGE_KEY, JSON.stringify({ roomId: "room-secure" }));

    expect(readReconnectSnapshotStatus("room-secure")).toBe("invalid");
    expect(window.sessionStorage.getItem(RECONNECT_STORAGE_KEY)).toBeNull();
  });

  it("clears reconnect snapshots from sessionStorage", () => {
    window.sessionStorage.setItem(
      RECONNECT_STORAGE_KEY,
      JSON.stringify({
        roomId: "room-secure",
        token: "room-secure:token",
        expiresAt: Date.now() + 1000,
      }),
    );

    clearReconnectSnapshot();

    expect(window.sessionStorage.getItem(RECONNECT_STORAGE_KEY)).toBeNull();
  });
});
