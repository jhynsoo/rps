import { boot, type ColyseusTestServer } from "@colyseus/testing";
import assert from "assert";

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

    it("gameStatus changes to mode_select when 2 players join", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "waiting");

      const client2 = await colyseus.connectTo(room);
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
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);

      await room.waitForNextPatch();
      assert.strictEqual(room.state.players.size, 2);

      try {
        await colyseus.connectTo(room);
        assert.fail("Should not allow third client");
      } catch (e) {
        assert.ok(true);
      }
    });
  });

  describe("Game Mode Selection Tests", () => {
    it("first player can select game mode", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
      const client2 = await colyseus.connectTo(room);
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameStatus, "mode_select");

      client1.send("select_mode", { mode: "best_of_3" });
      await room.waitForNextPatch();

      assert.strictEqual(room.state.gameMode, "best_of_3");
      assert.strictEqual(room.state.gameStatus, "choosing");
    });

    it("second player cannot select game mode", async () => {
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});
      const client1 = await colyseus.connectTo(room);
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
      const client2 = await colyseus.connectTo(room);
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
      const client2 = await colyseus.connectTo(room);
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
      const client2 = await colyseus.connectTo(room);
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
      const client2 = await colyseus.connectTo(room);
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
});
