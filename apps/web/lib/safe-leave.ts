import type { Room } from "colyseus.js";

export async function safeLeave(room: Room | null | undefined, consented?: boolean): Promise<void> {
  if (!room) return;

  try {
    if (typeof consented === "boolean") {
      await room.leave(consented);
      return;
    }

    await room.leave();
  } catch {
    // no-op: leaving during unload/disconnect must never surface unhandled rejection.
  }
}
