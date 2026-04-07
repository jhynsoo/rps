import { map, pipe, reduceLazy, toArray } from "@fxts/core";
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

export type GamePageView<P extends PlayerLike> = {
  self: P | null;
  scoreSummaries: ScoreSummary[];
};

export type ResultPageView<P extends Pick<PlayerLike, "sessionId" | "nickname" | "isReady">> = {
  self: P | null;
  opponent: P | null;
  readyCount: number;
  winnerLabel: string;
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

export function deriveGamePageView<P extends PlayerLike>(
  players: Iterable<P>,
  sessionId: string | null | undefined,
  fallbackLabel: string,
): GamePageView<P> {
  return pipe(
    players,
    reduceLazy<P, GamePageView<P>>(
      (acc, player) => {
        if (sessionId && player.sessionId === sessionId) {
          acc.self = player;
        }

        acc.scoreSummaries.push({
          sessionId: player.sessionId,
          nickname: player.nickname || fallbackLabel,
          score: player.score,
        });

        return acc;
      },
      {
        self: null,
        scoreSummaries: [],
      },
    ),
  );
}

export function deriveResultPageView<
  P extends Pick<PlayerLike, "sessionId" | "nickname" | "isReady">,
>(
  players: Iterable<P>,
  sessionId: string | null | undefined,
  winner: string,
  drawLabel: string,
): ResultPageView<P> {
  return pipe(
    players,
    reduceLazy<P, ResultPageView<P>>(
      (acc, player) => {
        if (player.isReady) {
          acc.readyCount += 1;
        }

        if (sessionId && player.sessionId === sessionId) {
          acc.self = player;
        } else if (sessionId && acc.opponent === null) {
          acc.opponent = player;
        }

        if (winner && winner !== "draw" && player.sessionId === winner) {
          acc.winnerLabel = player.nickname || winner.slice(0, 6);
        }

        return acc;
      },
      {
        self: null,
        opponent: null,
        readyCount: 0,
        winnerLabel: winner === "draw" ? drawLabel : "",
      },
    ),
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
