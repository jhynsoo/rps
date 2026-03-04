import assert from "node:assert";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import {
  ACTION_ERROR_CODES,
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  type ErrorEnvelope,
} from "@rps/contracts";
import type { Room } from "colyseus.js";

import appConfig from "../src/app.config";

function waitForErrorMessage(client: Room, timeoutMs = 500): Promise<ErrorEnvelope> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for server error message"));
    }, timeoutMs);

    let unsubscribe: (() => void) | undefined;
    unsubscribe = client.onMessage<ErrorEnvelope>(SERVER_MESSAGE_TYPES.ERROR, (message) => {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(message);
    });
  });
}

describe("RpsRoom error contract", () => {
  let colyseus: ColyseusTestServer;

  before(async () => {
    colyseus = await boot(appConfig);
  });

  after(async () => colyseus.shutdown());
  beforeEach(async () => await colyseus.cleanup());

  it("sends NOT_HOST error when non-host selects mode", async () => {
    const room = await colyseus.createRoom("my_room", {});
    const hostClient = await colyseus.connectTo(room);
    const guestClient = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    const errorPromise = waitForErrorMessage(guestClient);
    guestClient.send(CLIENT_MESSAGE_TYPES.SELECT_MODE, { mode: "single" });
    const error = await errorPromise;

    assert.strictEqual(error.boundary, "action");
    assert.strictEqual(error.code, ACTION_ERROR_CODES.NOT_HOST);
    assert.strictEqual(error.message, "Only the host can select the game mode.");

    await hostClient.leave();
    await guestClient.leave();
  });

  it("sends INVALID_PAYLOAD error for malformed select_mode payload", async () => {
    const room = await colyseus.createRoom("my_room", {});
    const hostClient = await colyseus.connectTo(room);
    const guestClient = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    const errorPromise = waitForErrorMessage(hostClient);
    (
      hostClient as unknown as {
        send: (type: string, message: unknown) => void;
      }
    ).send(CLIENT_MESSAGE_TYPES.SELECT_MODE, null);
    const error = await errorPromise;

    assert.strictEqual(error.boundary, "action");
    assert.strictEqual(error.code, ACTION_ERROR_CODES.INVALID_PAYLOAD);
    assert.strictEqual(error.message, "Invalid payload for select_mode.");

    await hostClient.leave();
    await guestClient.leave();
  });

  it("sends ALREADY_CHOSEN error when player submits choice twice", async () => {
    const room = await colyseus.createRoom("my_room", {});
    const hostClient = await colyseus.connectTo(room);
    const guestClient = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    hostClient.send(CLIENT_MESSAGE_TYPES.SELECT_MODE, { mode: "single" });
    await room.waitForNextPatch();

    hostClient.send(CLIENT_MESSAGE_TYPES.CHOICE, { choice: "rock" });
    await room.waitForNextPatch();

    const errorPromise = waitForErrorMessage(hostClient);
    hostClient.send(CLIENT_MESSAGE_TYPES.CHOICE, { choice: "paper" });
    const error = await errorPromise;

    assert.strictEqual(error.boundary, "action");
    assert.strictEqual(error.code, ACTION_ERROR_CODES.ALREADY_CHOSEN);
    assert.strictEqual(error.message, "Choice already submitted for this round.");

    await hostClient.leave();
    await guestClient.leave();
  });
});
