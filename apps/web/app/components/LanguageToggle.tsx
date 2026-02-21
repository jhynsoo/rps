"use client";

import { useRouter } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import type { Locale } from "@/lib/locale";

const LOCALES = ["ko", "en"] as const;

type LocaleCode = (typeof LOCALES)[number];

function isLocale(value: string | undefined): value is LocaleCode {
  return value === "ko" || value === "en";
}

export function LanguageToggle() {
  const router = useRouter();
  const t = useTranslations("lang");
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [hasError, setHasError] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  const activeLocale: Locale = isLocale(currentLocale) ? currentLocale : "ko";

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  async function changeLocale(locale: LocaleCode) {
    if (locale === activeLocale) return;

    setHasError(false);
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setHasError(true);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setHasError(true);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  return (
    <div className="fixed right-4 top-4 z-50 rounded-full border border-border bg-background/80 px-2 py-1.5">
      <div className="flex gap-2">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => {
              void changeLocale(locale);
            }}
            disabled={isPending}
            data-testid={locale === "ko" ? "lang-toggle-ko" : "lang-toggle-en"}
            aria-pressed={activeLocale === locale}
            className="h-8 rounded-full border border-transparent px-3 text-[11px] font-medium text-foreground transition hover:border-border disabled:cursor-not-allowed disabled:opacity-50"
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>

      {hasError ? (
        <p className="px-2 pb-1 pt-1 text-[10px] text-destructive">{t("changeFailed")}</p>
      ) : null}
    </div>
  );
}
