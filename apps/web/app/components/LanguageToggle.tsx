"use client";

import { useRouter } from "next/navigation";

import { useLocale } from "next-intl";
import { useTransition } from "react";

import type { Locale } from "@/lib/locale";

const LOCALES = ["ko", "en"] as const;

type LocaleCode = (typeof LOCALES)[number];

function isLocale(value: string | undefined): value is LocaleCode {
  return value === "ko" || value === "en";
}

export function LanguageToggle() {
  const router = useRouter();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  const activeLocale: Locale = isLocale(currentLocale) ? currentLocale : "ko";

  async function changeLocale(locale: LocaleCode) {
    if (locale === activeLocale) return;

    const response = await fetch("/api/locale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale }),
    });

    if (!response.ok) return;

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex gap-2 rounded-full border border-border bg-background/80 px-2 py-1.5">
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
  );
}
