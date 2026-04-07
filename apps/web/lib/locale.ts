import { find, pipe } from "@fxts/core";

export const SUPPORTED_LOCALES = ["ko", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: Locale = "ko";

const normalizeSingleLocale = (value: string | undefined | null): Locale | undefined => {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const token = trimmed.split(";")[0]?.trim() ?? "";
  if (!token) return undefined;

  const extracted = token.includes("=") ? token.split("=").at(-1) : token;
  const cleaned = extracted?.trim().replace(/^"|"$/g, "") ?? "";
  if (!cleaned) return undefined;

  const base = cleaned.split(/[-_]/)[0]?.toLowerCase();
  if (base === "ko" || base === "en") return base;

  return undefined;
};

export const normalizeLocale = (value: string | undefined | null): Locale | undefined =>
  normalizeSingleLocale(value);

export const resolveLocale = (
  cookieLocale: string | undefined | null,
  acceptLanguageHeader: string | undefined | null,
): Locale => {
  const fromCookie = normalizeLocale(cookieLocale);
  return (
    fromCookie ??
    pipe(
      acceptLanguageHeader?.split(",") ?? [],
      find((part) => normalizeLocale(part) !== undefined),
      (part) => (part ? normalizeLocale(part) : undefined),
    ) ??
    DEFAULT_LOCALE
  );
};
