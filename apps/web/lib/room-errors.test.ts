import { JOIN_ERROR_CODES } from "@rps/contracts";
import { describe, expect, it } from "vitest";

import { resolveCreateRoomErrorKey, resolveJoinRoomErrorKey } from "@/lib/room-errors";

describe("resolveCreateRoomErrorKey", () => {
  it("maps network failures to serverUnavailable", () => {
    expect(resolveCreateRoomErrorKey(new Error("ECONNREFUSED"))).toBe("errors.serverUnavailable");
  });

  it("falls back to createFailed for unknown errors", () => {
    expect(resolveCreateRoomErrorKey(new Error("unexpected"))).toBe("errors.createFailed");
  });
});

describe("resolveJoinRoomErrorKey", () => {
  it("maps room full errors", () => {
    expect(resolveJoinRoomErrorKey({ code: JOIN_ERROR_CODES.ROOM_FULL, message: "full" })).toBe(
      "errors.roomFull",
    );
  });

  it("maps not found errors", () => {
    expect(
      resolveJoinRoomErrorKey({ code: 4212, message: "matchmake error: room not found" }),
    ).toBe("errors.roomNotFound");
  });

  it("maps transport disconnect errors", () => {
    expect(resolveJoinRoomErrorKey(new Error("ECONNREFUSED"))).toBe("errors.serverUnavailable");
  });

  it("falls back to joinFailed", () => {
    expect(resolveJoinRoomErrorKey(new Error("unexpected"))).toBe("errors.joinFailed");
  });
});
