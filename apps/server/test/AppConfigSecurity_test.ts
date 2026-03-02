import assert from "node:assert";

import { isProductionMonitorEnabled, resolveAllowedOrigin } from "../src/app.config";

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

  describe("isProductionMonitorEnabled", () => {
    it("requires both username and password", () => {
      assert.strictEqual(isProductionMonitorEnabled("admin", "secret"), true);
      assert.strictEqual(isProductionMonitorEnabled("admin", undefined), false);
      assert.strictEqual(isProductionMonitorEnabled(undefined, "secret"), false);
      assert.strictEqual(isProductionMonitorEnabled("", "secret"), false);
    });
  });
});
