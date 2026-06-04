import assert from "node:assert";

import {
  assertAllowedMatchmakerOrigin,
  createMatchmakerCorsHeaders,
  createWebSocketVerifyClient,
  isProductionMonitorEnabled,
  resolveAllowedOrigin,
  resolveRequiredAllowedOrigins,
} from "../src/app.config";

describe("app.config security helpers", () => {
  describe("resolveAllowedOrigin", () => {
    it("returns origin only when it is present in allowlist", () => {
      const allowed = ["https://game.example.com", "https://staging.example.com"];

      assert.strictEqual(
        resolveAllowedOrigin("https://game.example.com", allowed),
        "https://game.example.com",
      );
      assert.strictEqual(resolveAllowedOrigin("https://evil.example.com", allowed), undefined);
      assert.strictEqual(resolveAllowedOrigin(undefined, allowed), undefined);
    });
  });

  describe("createMatchmakerCorsHeaders", () => {
    it("uses the explicit allowlist for Colyseus 0.17 Headers inputs", () => {
      const allowed = ["https://game.example.com"];

      assert.deepStrictEqual(createMatchmakerCorsHeaders(new Headers(), allowed), {
        Vary: "Origin",
        "Access-Control-Allow-Credentials": "false",
        "Access-Control-Allow-Origin": "null",
      });
      assert.deepStrictEqual(
        createMatchmakerCorsHeaders(new Headers({ origin: "https://game.example.com" }), allowed),
        {
          Vary: "Origin",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": "https://game.example.com",
        },
      );
      assert.deepStrictEqual(
        createMatchmakerCorsHeaders(new Headers({ origin: "https://evil.example.com" }), allowed),
        {
          Vary: "Origin",
          "Access-Control-Allow-Credentials": "false",
          "Access-Control-Allow-Origin": "null",
        },
      );
    });
  });

  describe("assertAllowedMatchmakerOrigin", () => {
    it("rejects disallowed browser origins before matchmaker side effects run", () => {
      assert.doesNotThrow(() =>
        assertAllowedMatchmakerOrigin(new Headers({ origin: "https://game.example.com" }), [
          "https://game.example.com",
        ]),
      );
      assert.throws(
        () =>
          assertAllowedMatchmakerOrigin(new Headers({ origin: "https://evil.example.com" }), [
            "https://game.example.com",
          ]),
        /Origin not allowed/,
      );
    });
  });

  describe("createWebSocketVerifyClient", () => {
    it("rejects WebSocket upgrades from disallowed origins", () => {
      const verifyClient = createWebSocketVerifyClient(["https://game.example.com"]);

      verifyClient({ origin: "https://game.example.com" }, (allowed, code, message) => {
        assert.strictEqual(allowed, true);
        assert.strictEqual(code, undefined);
        assert.strictEqual(message, undefined);
      });

      verifyClient({ origin: "https://evil.example.com" }, (allowed, code, message) => {
        assert.strictEqual(allowed, false);
        assert.strictEqual(code, 403);
        assert.strictEqual(message, "Origin not allowed");
      });
    });
  });

  describe("resolveRequiredAllowedOrigins", () => {
    it("requires an explicit allowlist in production", () => {
      assert.throws(
        () => resolveRequiredAllowedOrigins("production", undefined),
        /MATCHMAKER_ALLOWED_ORIGINS/,
      );
      assert.throws(
        () => resolveRequiredAllowedOrigins("production", "   "),
        /MATCHMAKER_ALLOWED_ORIGINS/,
      );
    });

    it("parses a production allowlist and permits empty values outside production", () => {
      assert.deepStrictEqual(
        resolveRequiredAllowedOrigins(
          "production",
          "https://game.example.com, https://staging.example.com",
        ),
        ["https://game.example.com", "https://staging.example.com"],
      );
      assert.deepStrictEqual(resolveRequiredAllowedOrigins("development", undefined), []);
    });
  });

  describe("isProductionMonitorEnabled", () => {
    it("requires both username and password", () => {
      assert.strictEqual(isProductionMonitorEnabled("admin", "secret"), true);
      assert.strictEqual(isProductionMonitorEnabled("admin", undefined), false);
      assert.strictEqual(isProductionMonitorEnabled(undefined, "secret"), false);
      assert.strictEqual(isProductionMonitorEnabled("", "secret"), false);
    });
  });
});
