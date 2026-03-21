import { JOIN_ERROR_CODES, TRANSPORT_ERROR_CODES } from "@rps/contracts";
import { describe, expect, it } from "vitest";
import { normalizeColyseusError } from "@/lib/colyseus-client";
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
