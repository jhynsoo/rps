import { describe, expect, it } from "vitest";

import { normalizeLocale, resolveLocale } from "@/lib/locale";

describe("normalizeLocale", () => {
  it("normalizes regioned locale tags", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("ko-KR")).toBe("ko");
  });

  it("normalizes cookie-style values", () => {
    expect(normalizeLocale("locale=en-US")).toBe("en");
    expect(normalizeLocale("  locale=ko-KR; Path=/  ")).toBe("ko");
  });

  it("normalizes mixed case and underscores", () => {
    expect(normalizeLocale(" En_Us ")).toBe("en");
    expect(normalizeLocale("kO-kr")).toBe("ko");
  });

  it("returns undefined for unsupported values", () => {
    expect(normalizeLocale("fr")).toBeUndefined();
    expect(normalizeLocale("fr-FR")).toBeUndefined();
    expect(normalizeLocale("")).toBeUndefined();
  });
});

describe("resolveLocale", () => {
  it("uses cookie value when valid", () => {
    expect(resolveLocale("en-US", "ko-KR")).toBe("en");
  });

  it("falls back to accept-language when cookie is missing", () => {
    expect(resolveLocale(undefined, "fr-FR, en-US;q=0.9, ko-KR")).toBe("en");
  });

  it("falls back to second token in accept-language", () => {
    expect(resolveLocale("", "fr-FR, ko-KR;q=0.8")).toBe("ko");
  });

  it("falls back to default locale when unsupported", () => {
    expect(resolveLocale("", "fr-FR, jp-JP")).toBe("ko");
    expect(resolveLocale(undefined, "malformed")).toBe("ko");
    expect(resolveLocale(undefined, "")).toBe("ko");
  });
});
