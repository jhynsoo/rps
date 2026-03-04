import { describe, expect, it } from "vitest";

import { resolveRoomRouteGuard } from "@/lib/room-route-guard";

describe("resolveRoomRouteGuard", () => {
  it("enforces mismatch as top priority", () => {
    const result = resolveRoomRouteGuard({
      page: "game",
      roomId: "url-room",
      room: null,
      storeRoomId: "active-room",
      hasRenderableState: false,
      gameStatus: "result",
      reconnectState: "trying",
      reconnectError: "expired",
    });

    expect(result).toEqual({
      kind: "mismatch",
      contractError: "actionRejected",
      activeRoomId: "active-room",
      urlRoomId: "url-room",
    });
  });

  it("returns reconnect_trying before no_room", () => {
    const result = resolveRoomRouteGuard({
      page: "room",
      roomId: "abc",
      room: null,
      storeRoomId: null,
      hasRenderableState: false,
      gameStatus: "waiting",
      reconnectState: "trying",
      reconnectError: null,
    });

    expect(result).toEqual({ kind: "reconnect_trying" });
  });

  it("maps no-room reconnect reasons to contract errors", () => {
    expect(
      resolveRoomRouteGuard({
        page: "room",
        roomId: "abc",
        room: null,
        storeRoomId: null,
        hasRenderableState: false,
        gameStatus: "waiting",
        reconnectState: "failed",
        reconnectError: "expired",
      }),
    ).toEqual({ kind: "no_room", contractError: "reconnectExpired" });

    expect(
      resolveRoomRouteGuard({
        page: "room",
        roomId: "abc",
        room: null,
        storeRoomId: null,
        hasRenderableState: false,
        gameStatus: "waiting",
        reconnectState: "failed",
        reconnectError: "invalid",
      }),
    ).toEqual({ kind: "no_room", contractError: "reconnectInvalid" });

    expect(
      resolveRoomRouteGuard({
        page: "room",
        roomId: "abc",
        room: null,
        storeRoomId: null,
        hasRenderableState: false,
        gameStatus: "waiting",
        reconnectState: "failed",
        reconnectError: "network",
      }),
    ).toEqual({ kind: "no_room", contractError: "joinUnavailable" });
  });

  it("resolves state redirects per page", () => {
    expect(
      resolveRoomRouteGuard({
        page: "room",
        roomId: "abc",
        room: {} as never,
        storeRoomId: "abc",
        hasRenderableState: true,
        gameStatus: "choosing",
        reconnectState: "idle",
        reconnectError: null,
      }),
    ).toEqual({ kind: "state_redirect", to: "/game/abc" });

    expect(
      resolveRoomRouteGuard({
        page: "game",
        roomId: "abc",
        room: {} as never,
        storeRoomId: "abc",
        hasRenderableState: true,
        gameStatus: "result",
        reconnectState: "idle",
        reconnectError: null,
      }),
    ).toEqual({ kind: "state_redirect", to: "/result/abc" });

    expect(
      resolveRoomRouteGuard({
        page: "result",
        roomId: "abc",
        room: {} as never,
        storeRoomId: "abc",
        hasRenderableState: true,
        gameStatus: "mode_select",
        reconnectState: "idle",
        reconnectError: null,
      }),
    ).toEqual({ kind: "state_redirect", to: "/room/abc" });
  });

  it("returns ready when nothing blocks rendering", () => {
    const result = resolveRoomRouteGuard({
      page: "game",
      roomId: "abc",
      room: {} as never,
      storeRoomId: "abc",
      hasRenderableState: true,
      gameStatus: "choosing",
      reconnectState: "idle",
      reconnectError: null,
    });

    expect(result).toEqual({ kind: "ready" });
  });
});
