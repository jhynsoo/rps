import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import * as esmContracts from "../dist/index.mjs";

const require = createRequire(import.meta.url);
const cjsContracts = require("../dist/index.cjs");

const expectedRuntimeExports = [
  "ACTION_ERROR_CODES",
  "CLIENT_MESSAGE_TYPES",
  "GAME_MODES",
  "GAME_STATUSES",
  "JOIN_ERROR_CODES",
  "NORMALIZED_ERROR_CODES",
  "RECONNECT_GRACE_SECONDS",
  "RECONNECT_STORAGE_KEY",
  "RECONNECT_TOKEN_TTL_MS",
  "RPS_CHOICES",
  "SERVER_MESSAGE_TYPES",
  "TRANSPORT_ERROR_CODES",
];

test("ESM and CJS runtime exports expose the same contract keys", () => {
  assert.deepEqual(Object.keys(esmContracts).sort(), expectedRuntimeExports.toSorted());
  assert.deepEqual(Object.keys(cjsContracts).sort(), expectedRuntimeExports.toSorted());
});

test("ESM and CJS runtime exports have identical values", () => {
  for (const key of expectedRuntimeExports) {
    assert.deepEqual(cjsContracts[key], esmContracts[key], key);
  }
});

test("reconnect token TTL is derived from reconnect grace seconds", () => {
  assert.equal(esmContracts.RECONNECT_TOKEN_TTL_MS, esmContracts.RECONNECT_GRACE_SECONDS * 1000);
});
