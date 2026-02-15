import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });

  it("ignores nullish and falsey class inputs", () => {
    expect(
      cn("font-medium", null, undefined, false && "hidden", "text-xs"),
    ).toBe("font-medium text-xs");
  });
});
