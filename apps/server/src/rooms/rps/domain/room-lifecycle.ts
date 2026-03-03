import type { PlayerState } from "../schema/RpsRoomState";

export const LOBBY_GAME_STATUS = "mode_select";

const RECONNECTABLE_GAME_STATUSES = new Set<string>([LOBBY_GAME_STATUS, "choosing", "result"]);

export function sanitizeNickname(value: unknown): string {
  if (typeof value !== "string") return "Player";

  const trimmed = value.trim();
  if (trimmed.length === 0) return "Player";

  return trimmed.slice(0, 12);
}

export function shouldAllowGracefulReconnection(params: {
  consented: boolean;
  playerCount: number;
  gameStatus: string;
}): boolean {
  if (params.consented) return false;
  if (params.playerCount !== 2) return false;

  return RECONNECTABLE_GAME_STATUSES.has(params.gameStatus);
}

export function shouldFinalizeRoundByForfeit(gameStatus: string, playerCount: number): boolean {
  if (playerCount !== 2) return false;
  return gameStatus !== "waiting" && gameStatus !== "finished";
}

export function nextHostSessionId(players: Iterable<PlayerState>, fallback = ""): string {
  const firstPlayer = players[Symbol.iterator]().next().value as PlayerState | undefined;
  return firstPlayer?.sessionId ?? fallback;
}

export function syncRoomLock(
  room: { maxClients: number; lock: () => void; unlock: () => void },
  playerCount: number,
): void {
  if (playerCount >= room.maxClients) {
    room.lock();
    return;
  }

  room.unlock();
}
