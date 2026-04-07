"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { MAX_NICKNAME_LENGTH, NICKNAME_STORAGE_KEY, sanitizeNickname } from "@/lib/nickname";
import { readStoredNicknameResolution } from "@/lib/nickname-session";

export default function Home() {
  const router = useRouter();
  const t = useTranslations("home");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [nickname, setNickname] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const { nickname: savedNickname } = readStoredNicknameResolution();
    if (savedNickname) setNickname(savedNickname);
  }, []);

  const validationMessage = useMemo(() => {
    if (!touched) return null;
    if (sanitizeNickname(nickname).length === 0) return t("nicknameRequired");
    return null;
  }, [nickname, touched, t]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);

    const cleaned = sanitizeNickname(nickname);
    if (!cleaned) {
      inputRef.current?.focus();
      return;
    }

    window.localStorage.setItem(NICKNAME_STORAGE_KEY, cleaned);
    router.push("/menu");
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="inline-flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-border bg-card shadow-sm">
              <span className="font-mono text-lg">{t("title")}</span>
            </div>
            <div>
              <h1 className="font-mono text-2xl tracking-tight" data-testid="home-nickname-prompt">
                {t("nicknamePrompt")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("nicknameDescription")}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-xs font-medium text-muted-foreground">
                {t("nicknameLabel", { max: MAX_NICKNAME_LENGTH })}
              </label>
              <input
                ref={inputRef}
                id="nickname"
                name="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={t("nicknamePlaceholder")}
                autoComplete="nickname"
                maxLength={MAX_NICKNAME_LENGTH}
                data-testid="nickname-input"
                className="h-12 w-full rounded-xl border border-border bg-card px-4 text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
              {validationMessage ? (
                <p className="text-xs text-destructive">{validationMessage}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("nicknameWhitespaceHint")}</p>
              )}
            </div>

            <button
              type="submit"
              data-testid="nickname-submit"
              className="group inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{t("continue")}</span>
              <span className="font-mono text-xs opacity-70 transition group-hover:opacity-100">
                {t("enterHint")}
              </span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
