import { filter, find, map, pipe, toArray } from "@fxts/core";
import type { PlayerStateView } from "@rps/contracts";
import type { Room } from "colyseus.js";

export type PlayerLike = Pick<PlayerStateView, "sessionId" | "nickname" | "isReady" | "score"> & {
  choice?: string;
};

export type PlayersCollectionLike<P extends PlayerLike = PlayerLike> = {
  size: number;
  values: () => IterableIterator<P>;
};

type PlayersStateLike = {
  players?: unknown;
};

export type RoomPlayerSummary = {
  sessionId: string;
  nickname: string;
  isHost: boolean;
  sessionIdLabel: string;
};

export type ScoreSummary = {
  sessionId: string;
  nickname: string;
  score: number;
};

export function hasPlayersCollection<P extends PlayerLike>(
  value: unknown,
): value is PlayersCollectionLike<P> {
  if (typeof value !== "object" || value === null) return false;
  const maybe = value as { size?: unknown; values?: unknown };
  return typeof maybe.size === "number" && typeof maybe.values === "function";
}

export function getRenderableRoomState<S extends PlayersStateLike>(
  room: Room | null,
): (S & { players: PlayersCollectionLike }) | null {
  if (!room) return null;

  const state = room.state as S | undefined;
  if (!state || !hasPlayersCollection((state as PlayersStateLike).players)) return null;

  return state as S & { players: PlayersCollectionLike };
}

export function materializePlayers<P extends PlayerLike>(
  players: PlayersCollectionLike<P> | null | undefined,
): P[] {
  if (!players) return [];
  return pipe(players.values(), toArray);
}

export function findPlayerBySessionId<P extends PlayerLike>(
  players: Iterable<P>,
  sessionId: string | null | undefined,
): P | null {
  if (!sessionId) return null;
  return (pipe(
    players,
    find((player) => player.sessionId === sessionId),
  ) ?? null) as P | null;
}

export function findOpponentBySessionId<P extends PlayerLike>(
  players: Iterable<P>,
  sessionId: string | null | undefined,
): P | null {
  if (!sessionId) return null;
  return (pipe(
    players,
    find((player) => player.sessionId !== sessionId),
  ) ?? null) as P | null;
}

export function countReadyPlayers<P extends Pick<PlayerLike, "isReady">>(
  players: Iterable<P>,
): number {
  return pipe(
    players,
    filter((player) => player.isReady),
    toArray,
    (readyPlayers) => readyPlayers.length,
  );
}

export function resolveWinnerLabel<P extends Pick<PlayerLike, "sessionId" | "nickname">>(
  winner: string,
  players: Iterable<P>,
  drawLabel: string,
): string {
  if (!winner) return "";
  if (winner === "draw") return drawLabel;

  return (
    (
      pipe(
        players,
        find((player) => player.sessionId === winner),
      ) as P | undefined
    )?.nickname || winner.slice(0, 6)
  );
}

export function buildScoreSummaries<P extends Pick<PlayerLike, "sessionId" | "nickname" | "score">>(
  players: Iterable<P>,
  fallbackLabel: string,
): ScoreSummary[] {
  return pipe(
    players,
    map((player) => ({
      sessionId: player.sessionId,
      nickname: player.nickname || fallbackLabel,
      score: player.score,
    })),
    toArray,
  );
}

export function buildRoomPlayerSummaries<P extends Pick<PlayerLike, "sessionId" | "nickname">>(
  players: Iterable<P>,
  hostSessionId: string,
  fallbackLabel: string,
): RoomPlayerSummary[] {
  return pipe(
    players,
    map((player) => ({
      sessionId: player.sessionId,
      nickname: player.nickname || fallbackLabel,
      isHost: player.sessionId === hostSessionId,
      sessionIdLabel: player.sessionId.slice(0, 4),
    })),
    toArray,
  );
}
