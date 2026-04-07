"use client";

import type { Room } from "colyseus.js";
import { useEffect, useRef, useState } from "react";

import type { RoomRouteGuardResult } from "@/lib/room-route-guard";

type ReconnectAttemptInput = {
  room: Room | null;
  roomId: string;
  routeGuardKind: RoomRouteGuardResult["kind"];
  attemptReconnect: (roomId: string) => Promise<boolean>;
};

export function useRouteGuardRedirect(
  routeGuard: RoomRouteGuardResult,
  replace: (path: string) => void,
) {
  useEffect(() => {
    if (routeGuard.kind !== "state_redirect") return;
    replace(routeGuard.to);
  }, [replace, routeGuard]);
}

export function useDelayedReconnectAttempt({
  room,
  roomId,
  routeGuardKind,
  attemptReconnect,
}: ReconnectAttemptInput) {
  const reconnectAttemptedRef = useRef(false);

  useEffect(() => {
    if (room) return;
    if (!roomId) return;
    if (routeGuardKind === "mismatch") return;
    if (reconnectAttemptedRef.current) return;

    reconnectAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      void attemptReconnect(roomId);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [attemptReconnect, room, roomId, routeGuardKind]);
}

export function useOpponentLeftState(playersCount: number): boolean {
  const hadTwoPlayersRef = useRef(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  useEffect(() => {
    if (playersCount === 2) {
      hadTwoPlayersRef.current = true;
      setOpponentLeft(false);
      return;
    }

    if (playersCount === 1 && hadTwoPlayersRef.current) {
      setOpponentLeft(true);
    }
  }, [playersCount]);

  return opponentLeft;
}
