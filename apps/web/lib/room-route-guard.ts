import type { Room } from "colyseus.js";

export type RoomRoutePage = "room" | "game" | "result";
export type RoomRouteReconnectState = "idle" | "trying" | "succeeded" | "failed";
export type RoomRouteReconnectError = "expired" | "invalid" | "network" | null;

export type RoomRouteContractError =
  | "joinUnavailable"
  | "reconnectExpired"
  | "reconnectInvalid"
  | "actionRejected";

export type RoomRouteGuardResult =
  | {
      kind: "mismatch";
      contractError: "actionRejected";
      activeRoomId: string;
      urlRoomId: string;
    }
  | { kind: "reconnect_trying" }
  | {
      kind: "no_room";
      contractError: Exclude<RoomRouteContractError, "actionRejected">;
    }
  | { kind: "state_redirect"; to: string }
  | { kind: "ready" };

type RoomRouteGuardInput = {
  page: RoomRoutePage;
  roomId: string;
  room: Room | null;
  storeRoomId: string | null;
  hasRenderableState: boolean;
  gameStatus: string;
  reconnectState: RoomRouteReconnectState;
  reconnectError: RoomRouteReconnectError;
};

function stateRedirectPath(page: RoomRoutePage, roomId: string, gameStatus: string): string | null {
  if (!roomId) return null;

  if (page === "room") {
    if (gameStatus === "choosing") return `/game/${roomId}`;
    if (gameStatus === "result" || gameStatus === "finished") return `/result/${roomId}`;
    return null;
  }

  if (page === "game") {
    if (gameStatus === "waiting" || gameStatus === "mode_select") return `/room/${roomId}`;
    if (gameStatus === "result" || gameStatus === "finished") return `/result/${roomId}`;
    return null;
  }

  if (gameStatus === "waiting" || gameStatus === "mode_select") return `/room/${roomId}`;
  if (gameStatus === "choosing") return `/game/${roomId}`;
  return null;
}

function mapReconnectErrorToContractError(
  reconnectError: RoomRouteReconnectError,
): Exclude<RoomRouteContractError, "actionRejected"> {
  if (reconnectError === "expired") return "reconnectExpired";
  if (reconnectError === "invalid") return "reconnectInvalid";
  return "joinUnavailable";
}

export function resolveRoomRouteGuard(input: RoomRouteGuardInput): RoomRouteGuardResult {
  const isMismatch = !!input.storeRoomId && input.storeRoomId !== input.roomId;
  if (isMismatch) {
    return {
      kind: "mismatch",
      contractError: "actionRejected",
      activeRoomId: input.storeRoomId ?? "-",
      urlRoomId: input.roomId || "-",
    };
  }

  const hasRoomAndState = !!input.room && input.hasRenderableState;
  if (!hasRoomAndState && input.reconnectState === "trying") {
    return { kind: "reconnect_trying" };
  }

  if (!hasRoomAndState) {
    return {
      kind: "no_room",
      contractError: mapReconnectErrorToContractError(input.reconnectError),
    };
  }

  const redirectPath = stateRedirectPath(input.page, input.roomId, input.gameStatus);
  if (redirectPath) return { kind: "state_redirect", to: redirectPath };

  return { kind: "ready" };
}
