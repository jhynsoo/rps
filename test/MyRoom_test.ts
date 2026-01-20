import { boot, type ColyseusTestServer } from "@colyseus/testing";
import assert from "assert";

// import your "app.config.ts" file here.
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
      // `room` is the server-side Room instance reference.
      const room = await colyseus.createRoom<MyRoomState>("my_room", {});

      // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
      const client1 = await colyseus.connectTo(room);

      // make your assertions
      assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

      // wait for state sync
      await room.waitForNextPatch();

      // Verify new schema structure
      const state = client1.state.toJSON() as Record<string, unknown>;
      assert.strictEqual(state.gameStatus, "waiting");
      assert.strictEqual(state.gameMode, "");
      assert.strictEqual(state.countdown, 0);
      assert.strictEqual(state.winner, "");
      assert.strictEqual(state.roundNumber, 1);
      assert.ok(state.players !== undefined);
    });
  });
});
