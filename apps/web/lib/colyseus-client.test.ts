import { describe, expect, it } from "vitest";

import { normalizeColyseusError } from "@/lib/colyseus-client";

describe("normalizeColyseusError", () => {
  it("maps join room-not-found errors", () => {
    const normalized = normalizeColyseusError(new Error("roomId not found"), "join");
    expect(normalized.code).toBe("ROOM_NOT_FOUND");
  });

  it("maps join room-full errors", () => {
    const normalized = normalizeColyseusError(new Error("maxClients reached"), "join");
    expect(normalized.code).toBe("ROOM_FULL");
  });

  it("maps boundary-specific reconnect token errors", () => {
    const invalid = normalizeColyseusError(
      new Error("Invalid reconnection token format"),
      "reconnect",
    );
    const expired = normalizeColyseusError(new Error("token expired"), "reconnect");

    expect(invalid.code).toBe("RECONNECT_TOKEN_INVALID");
    expect(expired.code).toBe("RECONNECT_TOKEN_EXPIRED");
  });

  it("maps network failures for create/join/reconnect", () => {
    expect(normalizeColyseusError(new Error("ECONNREFUSED"), "create").code).toBe(
      "SERVER_UNAVAILABLE",
    );
    expect(normalizeColyseusError(new Error("timeout"), "join").code).toBe("SERVER_UNAVAILABLE");
    expect(normalizeColyseusError(new Error("websocket closed"), "reconnect").code).toBe(
      "SERVER_UNAVAILABLE",
    );
  });

  it("returns UNKNOWN for unmatched errors", () => {
    const normalized = normalizeColyseusError(new Error("unexpected failure"), "create");
    expect(normalized.code).toBe("UNKNOWN");
  });
});
