import type { PlayerState } from "../schema/RpsRoomState";

export const WAITING_GAME_STATUS = "waiting";
export const LOBBY_GAME_STATUS = "mode_select";
export const CHOOSING_GAME_STATUS = "choosing";
export const RESULT_GAME_STATUS = "result";
export const FINISHED_GAME_STATUS = "finished";

const RECONNECTABLE_GAME_STATUSES = new Set<string>([
  LOBBY_GAME_STATUS,
  CHOOSING_GAME_STATUS,
  RESULT_GAME_STATUS,
]);

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
  return gameStatus !== WAITING_GAME_STATUS && gameStatus !== FINISHED_GAME_STATUS;
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
