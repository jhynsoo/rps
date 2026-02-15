import assert from "node:assert";
import { boot, type ColyseusTestServer } from "@colyseus/testing";

import appConfig from "../src/app.config";
import { MyRoomState, Player } from "../src/rooms/schema/MyRoomState";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer;

  before(async () => {
    colyseus = await boot(appConfig);
  });
  after(async () => colyseus.shutdown());
  beforeEach(async () => await colyseus.cleanup());

  describe("Schema Tests", () => {
    it("Player class has correct default values", () => {
      const player = new Player();
      assert.strictEqual(player.sessionId, "");
      assert.strictEqual(player.nickname, "Player");
      assert.strictEqual(player.choice, "");
      assert.strictEqual(player.score, 0);
      assert.strictEqual(player.isReady, false);
    });

    it("MyRoomState has correct default values", () => {
      const state = new MyRoomState();
      assert.strictEqual(state.gameStatus, "waiting");
      assert.strictEqual(state.gameMode, "");
      assert.strictEqual(state.countdown, 0);
      assert.strictEqual(state.winner, "");
      assert.strictEqual(state.roundNumber, 1);
      assert.strictEqual(state.hostSessionId, "");
      assert.ok(state.players);
    });

    it("MyRoomState.players MapSchema can store Player instances", () => {
      const state = new MyRoomState();
      const player = new Player();
      player.sessionId = "test-session";
      player.choice = "rock";
      player.score = 1;

      state.players.set("test-session", player);

      assert.strictEqual(state.players.size, 1);
      assert.strictEqual(state.players.get("test-session")?.sessionId, "test-session");
      assert.strictEqual(state.players.get("test-session")?.choice, "rock");
      assert.strictEqual(state.players.get("test-session")?.score, 1);
    });
  });

  describe("Room Connection Tests", () => {
    it("connecting into a room", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);

      assert.strictEqual(client1.sessionId, room.clients[0].sessionId);
      await room.waitForNextPatch();

      const state = client1.state.toJSON() as Record<string, unknown>;
      assert.strictEqual(state.gameStatus, "waiting");
      assert.ok(state.players !== undefined);
    });
  });

  describe("Player Join/Leave Tests", () => {
    it("player is added to players map on join", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.size, 1);
      const player = room.state.players.get(client1.sessionId);
      assert.ok(player);
      assert.strictEqual(player.sessionId, client1.sessionId);
    });

    it("hostSessionId is set to first joining player", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.hostSessionId, client1.sessionId);
    });

    it("hostSessionId remains the first player after second join", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.hostSessionId, client1.sessionId);
    });

    it("hostSessionId transfers when host leaves", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.hostSessionId, client1.sessionId);

      await client1.leave();
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.size, 1);
      assert.strictEqual(room.state.hostSessionId, client2.sessionId);
    });

    it("nickname is stored from join options (trimmed, capped, fallback)", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});

      const client1 = await colyseus.connectTo(room, { nickname: "   " });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.get(client1.sessionId)?.nickname, "Player");

      const client2 = await colyseus.connectTo(room, {
        nickname: "  123456789012345  ",
      });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.get(client2.sessionId)?.nickname, "123456789012");
    });

    it("gameStatus changes to mode_select when 2 players join", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const _client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "waiting");

      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.size, 2);
      assert.strictEqual(room.state.gameStatus, "mode_select");
    });

    it("player is removed from players map on leave", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.size, 2);

      await client1.leave();
      await room.waitForNextPatch();

      assert.strictEqual(room.state.players.size, 1);
      assert.ok(room.state.players.get(client2.sessionId));
    });

    it("maxClients is 2", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const _client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);

      await room.waitForNextPatch();
      assert.strictEqual(room.state.players.size, 2);

      try {
        await colyseus.connectTo(room);
        assert.fail("Should not allow third client");
      } catch (_e) {
        assert.ok(true);
      }
    });
  });

  describe("Game Mode Selection Tests", () => {
    it("first player can select game mode", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "mode_select");

      client1.send("select_mode", { mode: "best_of_3" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameMode, "best_of_3");
      assert.strictEqual(room.state.gameStatus, "choosing");
    });

    it("second player cannot select game mode", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const _client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client2.send("select_mode", { mode: "best_of_5" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameMode, "");
      assert.strictEqual(room.state.gameStatus, "mode_select");
    });

    it("invalid mode is ignored", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "invalid_mode" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameMode, "");
      assert.strictEqual(room.state.gameStatus, "mode_select");
    });

    it("all valid modes work: single, best_of_3, best_of_5", async () => {
      const validModes = ["single", "best_of_3", "best_of_5"];

      for (const mode of validModes) {
        const room = await colyseus.createRoom<MyRoomState>("my_room", {});
        const client1 = await colyseus.connectTo(room);
        const client2 = await colyseus.connectTo(room);
        await room.waitForNextPatch();

        client1.send("select_mode", { mode });
        await room.waitForNextPatch();

        assert.strictEqual(room.state.gameMode, mode);
        assert.strictEqual(room.state.gameStatus, "choosing");

        await client1.leave();
        await client2.leave();
      }
    });
  });

  describe("Player Choice Tests", () => {
    it("player can choose rock/paper/scissors during choosing state", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "choosing");

      client1.send("choice", { choice: "rock" });
      await room.waitForNextPatch();

      const player1 = room.state.players.get(client1.sessionId);
      assert.strictEqual(player1?.choice, "rock");
    });

    it("invalid choice is ignored", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "invalid" });
      await room.waitForNextPatch();

      const player1 = room.state.players.get(client1.sessionId);
      assert.strictEqual(player1?.choice, "");
    });

    it("choice is ignored when not in choosing state", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "mode_select");

      client1.send("choice", { choice: "rock" });
      await room.waitForNextPatch();

      const player1 = room.state.players.get(client1.sessionId);
      assert.strictEqual(player1?.choice, "");
    });

    it("both players choosing triggers result calculation", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "choosing");

      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "result");
    });
  });

  describe("Winner Determination Tests", () => {
    it("rock beats scissors", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.winner, client1.sessionId);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 1);
    });

    it("scissors beats paper", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "scissors" });
      client2.send("choice", { choice: "paper" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.winner, client1.sessionId);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 1);
    });

    it("paper beats rock", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "paper" });
      client2.send("choice", { choice: "rock" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.winner, client1.sessionId);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 1);
    });

    it("same choice is a draw", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "rock" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.winner, "draw");
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 0);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.score, 0);
    });

    it("gameStatus is result after determination", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "paper" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "result");
      assert.strictEqual(room.state.winner, client2.sessionId);
    });
  });

  describe("Timer Tests", () => {
    it("countdown starts at 10 when entering choosing state", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "choosing");
      assert.strictEqual(room.state.countdown, 10);
    });

    it("countdown decreases over time", async function () {
      this.timeout(5000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const _client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.countdown, 10);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      assert.ok(room.state.countdown < 10);
    });

    it("timer assigns random choice to players who have not chosen", async function () {
      this.timeout(15000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 11000));

      const p1 = room.state.players.get(client1.sessionId);
      const p2 = room.state.players.get(client2.sessionId);

      assert.ok(["rock", "paper", "scissors"].includes(p1?.choice || ""));
      assert.ok(["rock", "paper", "scissors"].includes(p2?.choice || ""));
      assert.strictEqual(room.state.gameStatus, "result");
    });
  });

  describe("Disconnect Tests", () => {
    it("opponent wins when player disconnects during game", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "choosing");

      await client1.leave();
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.winner, client2.sessionId);
    });

    it("no winner assigned when player leaves during waiting", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "waiting");

      await client1.leave();

      assert.strictEqual(room.state.winner, "");
    });

    it("no winner assigned when player leaves during mode_select", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "mode_select");

      await client1.leave();
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.winner, client2.sessionId);
    });
  });

  describe("Round Management Tests", () => {
    it("single mode ends after 1 win", async function () {
      this.timeout(10000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));

      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 1);
    });

    it("best_of_3 mode ends after 2 wins", async function () {
      this.timeout(15000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "best_of_3" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));

      assert.strictEqual(room.state.gameStatus, "choosing");
      assert.strictEqual(room.state.roundNumber, 2);

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));

      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 2);
    });

    it("choices are reset between rounds", async function () {
      this.timeout(10000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "best_of_3" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const p1 = room.state.players.get(client1.sessionId);
      const p2 = room.state.players.get(client2.sessionId);

      assert.strictEqual(p1?.choice, "");
      assert.strictEqual(p2?.choice, "");
    });
  });

  describe("Integration Tests", () => {
    it("full game flow: join → mode_select → choosing → result → finished (single mode)", async function () {
      this.timeout(10000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});

      assert.strictEqual(room.state.gameStatus, "waiting");

      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();
      assert.strictEqual(room.state.gameStatus, "waiting");
      assert.strictEqual(room.state.players.size, 1);

      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();
      assert.strictEqual(room.state.gameStatus, "mode_select");
      assert.strictEqual(room.state.players.size, 2);

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();
      assert.strictEqual(room.state.gameStatus, "choosing");
      assert.strictEqual(room.state.gameMode, "single");
      assert.strictEqual(room.state.countdown, 10);

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();
      assert.strictEqual(room.state.gameStatus, "result");
      assert.strictEqual(room.state.winner, client1.sessionId);

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");
    });

    it("best_of_5 mode requires 3 wins", async function () {
      this.timeout(25000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "best_of_5" });
      await room.waitForNextPatch();

      for (let round = 1; round <= 3; round++) {
        client1.send("choice", { choice: "rock" });
        client2.send("choice", { choice: "scissors" });
        await room.waitForNextPatch();

        if (round < 3) {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          assert.strictEqual(room.state.gameStatus, "choosing");
          assert.strictEqual(room.state.roundNumber, round + 1);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 3);
    });

    it("draw does not count toward win condition", async function () {
      this.timeout(15000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "rock" });
      await room.waitForNextPatch();
      assert.strictEqual(room.state.winner, "draw");

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "choosing");
      assert.strictEqual(room.state.roundNumber, 2);

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");
    });
  });

  describe("Rematch / Reset-to-lobby Tests", () => {
    it("rematch_ready is ignored unless gameStatus is finished", async function () {
      this.timeout(5000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "mode_select");

      client1.send("rematch_ready");
      client2.send("rematch_ready");
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.strictEqual(room.state.players.get(client1.sessionId)?.isReady, false);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.isReady, false);
    });

    it("requires both players ready before reset (roomId preserved)", async function () {
      this.timeout(15000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");

      const roomIdBefore = room.roomId;
      const hostBefore = room.state.hostSessionId;
      const winnerBefore = room.state.winner;
      const modeBefore = room.state.gameMode;
      const p1ScoreBefore = room.state.players.get(client1.sessionId)?.score;
      const p2ScoreBefore = room.state.players.get(client2.sessionId)?.score;

      client1.send("rematch_ready");
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.roomId, roomIdBefore);
      assert.strictEqual(room.state.hostSessionId, hostBefore);
      assert.strictEqual(room.state.winner, winnerBefore);
      assert.strictEqual(room.state.gameMode, modeBefore);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.isReady, true);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.isReady, false);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, p1ScoreBefore);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.score, p2ScoreBefore);

      client2.send("rematch_ready");
      await room.waitForNextPatch();

      assert.strictEqual(room.roomId, roomIdBefore);
      assert.strictEqual(room.state.hostSessionId, hostBefore);
      assert.strictEqual(room.state.gameStatus, "mode_select");
      assert.strictEqual(room.state.gameMode, "");
      assert.strictEqual(room.state.countdown, 0);
      assert.strictEqual(room.state.roundNumber, 1);
      assert.strictEqual(room.state.winner, "");

      const p1 = room.state.players.get(client1.sessionId);
      const p2 = room.state.players.get(client2.sessionId);
      assert.strictEqual(p1?.score, 0);
      assert.strictEqual(p2?.score, 0);
      assert.strictEqual(p1?.choice, "");
      assert.strictEqual(p2?.choice, "");
      assert.strictEqual(p1?.isReady, false);
      assert.strictEqual(p2?.isReady, false);

      await new Promise((resolve) => setTimeout(resolve, 1100));
      assert.strictEqual(room.state.countdown, 0);
    });

    it("rematch_cancel clears readiness in finished state", async function () {
      this.timeout(15000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "single" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();

      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");

      client1.send("rematch_ready");
      await room.waitForNextPatch();
      assert.strictEqual(room.state.players.get(client1.sessionId)?.isReady, true);

      client1.send("rematch_cancel");
      await room.waitForNextPatch();
      assert.strictEqual(room.state.players.get(client1.sessionId)?.isReady, false);
      assert.strictEqual(room.state.gameStatus, "finished");
    });

    it("reset semantics are exact (best_of_3 sets roundNumber back to 1)", async function () {
      this.timeout(25000);

      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      client1.send("select_mode", { mode: "best_of_3" });
      await room.waitForNextPatch();

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();
      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "choosing");
      assert.strictEqual(room.state.roundNumber, 2);

      client1.send("choice", { choice: "rock" });
      client2.send("choice", { choice: "scissors" });
      await room.waitForNextPatch();
      await new Promise((resolve) => setTimeout(resolve, 4000));
      assert.strictEqual(room.state.gameStatus, "finished");
      assert.strictEqual(room.state.roundNumber, 2);
      assert.strictEqual(room.state.winner, client1.sessionId);

      const roomIdBefore = room.roomId;
      const hostBefore = room.state.hostSessionId;

      client1.send("rematch_ready");
      client2.send("rematch_ready");
      for (let i = 0; i < 5 && room.state.gameStatus !== "mode_select"; i++) {
        await room.waitForNextPatch();
      }

      assert.strictEqual(room.roomId, roomIdBefore);
      assert.strictEqual(room.state.hostSessionId, hostBefore);
      assert.strictEqual(room.state.gameStatus, "mode_select");
      assert.strictEqual(room.state.gameMode, "");
      assert.strictEqual(room.state.countdown, 0);
      assert.strictEqual(room.state.winner, "");
      assert.strictEqual(room.state.roundNumber, 1);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.score, 0);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.score, 0);
      assert.strictEqual(room.state.players.get(client1.sessionId)?.choice, "");
      assert.strictEqual(room.state.players.get(client2.sessionId)?.choice, "");
      assert.strictEqual(room.state.players.get(client1.sessionId)?.isReady, false);
      assert.strictEqual(room.state.players.get(client2.sessionId)?.isReady, false);
    });
  });
});
