import type { PlayerState } from "../schema/RpsRoomState";

export function markPlayerRematchReady(player: PlayerState): void {
  player.isReady = true;
}

export function clearPlayerRematchReady(player: PlayerState): void {
  player.isReady = false;
}

export function areAllPlayersRematchReady(players: Iterable<PlayerState>): boolean {
  for (const player of players) {
    if (!player.isReady) {
      return false;
    }
  }

  return true;
}

export function resetPlayersForLobby(players: Iterable<PlayerState>): void {
  for (const player of players) {
    player.score = 0;
    player.choice = "";
    player.isReady = false;
  }
}
