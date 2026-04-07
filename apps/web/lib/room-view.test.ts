import type { Room } from "colyseus.js";
import { describe, expect, it } from "vitest";

import {
  buildRoomPlayerSummaries,
  buildScoreSummaries,
  countReadyPlayers,
  findOpponentBySessionId,
  findPlayerBySessionId,
  getRenderableRoomState,
  materializePlayers,
  resolveWinnerLabel,
} from "@/lib/room-view";

const players = [
  {
    sessionId: "host-session",
    nickname: "Host",
    isReady: true,
    score: 2,
  },
  {
    sessionId: "guest-session",
    nickname: "",
    isReady: false,
    score: 1,
  },
];

function createRoomWithPlayers() {
  return {
    state: {
      players: {
        size: players.length,
        values: function* values() {
          yield* players;
        },
      },
    },
  } as Room;
}

describe("room-view selectors", () => {
  it("materializes renderable room state players", () => {
    const state = getRenderableRoomState<{ players: unknown }>(createRoomWithPlayers());
    expect(materializePlayers(state?.players)).toEqual(players);
  });

  it("finds self and opponent by session id", () => {
    expect(findPlayerBySessionId(players, "host-session")).toEqual(players[0]);
    expect(findOpponentBySessionId(players, "host-session")).toEqual(players[1]);
  });

  it("counts ready players", () => {
    expect(countReadyPlayers(players)).toBe(1);
  });

  it("resolves winner labels for players and draw", () => {
    expect(resolveWinnerLabel("host-session", players, "Draw")).toBe("Host");
    expect(resolveWinnerLabel("draw", players, "Draw")).toBe("Draw");
  });

  it("builds score and room player summaries", () => {
    expect(buildScoreSummaries(players, "Player")).toEqual([
      { sessionId: "host-session", nickname: "Host", score: 2 },
      { sessionId: "guest-session", nickname: "Player", score: 1 },
    ]);

    expect(buildRoomPlayerSummaries(players, "host-session", "Player")).toEqual([
      {
        sessionId: "host-session",
        nickname: "Host",
        isHost: true,
        sessionIdLabel: "host",
      },
      {
        sessionId: "guest-session",
        nickname: "Player",
        isHost: false,
        sessionIdLabel: "gues",
      },
    ]);
  });
});
