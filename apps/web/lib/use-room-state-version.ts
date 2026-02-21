"use client";

import type { Room } from "colyseus.js";
import { useEffect, useState } from "react";

export function useRoomStateVersion(room: Room | null): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion(0);

    if (!room) return;

    const handleStateChange = () => {
      setVersion((current) => current + 1);
    };

    room.onStateChange(handleStateChange);

    return () => {
      room.onStateChange.remove(handleStateChange);
    };
  }, [room]);

  return version;
}
