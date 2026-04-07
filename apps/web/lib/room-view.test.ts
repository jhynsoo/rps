import type { Room } from "colyseus.js";
import { describe, expect, it } from "vitest";

import {
  buildRoomPlayerSummaries,
  deriveGamePageView,
  deriveResultPageView,
  getRenderableRoomState,
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
  it("exposes renderable room state players", () => {
    const state = getRenderableRoomState<{ players: unknown }>(createRoomWithPlayers());
    expect(state?.players.size).toBe(players.length);
  });

  it("derives game page view in a single pass", () => {
    expect(deriveGamePageView(players, "host-session", "Player")).toEqual({
      self: players[0],
      scoreSummaries: [
        { sessionId: "host-session", nickname: "Host", score: 2 },
        { sessionId: "guest-session", nickname: "Player", score: 1 },
      ],
    });
  });

  it("derives result page view for winners and draws", () => {
    expect(deriveResultPageView(players, "host-session", "host-session", "Draw")).toEqual({
      self: players[0],
      opponent: players[1],
      readyCount: 1,
      winnerLabel: "Host",
    });

    expect(deriveResultPageView(players, "host-session", "draw", "Draw")).toEqual({
      self: players[0],
      opponent: players[1],
      readyCount: 1,
      winnerLabel: "Draw",
    });
  });

  it("builds room player summaries", () => {
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
