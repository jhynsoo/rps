"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { NICKNAME_STORAGE_KEY, sanitizeNickname } from "@/lib/nickname";

export default function LobbyPage() {
  const router = useRouter();
  const t = useTranslations("lobby");
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
    const cleaned = saved ? sanitizeNickname(saved) : "";

    if (!cleaned) {
      if (saved) window.localStorage.removeItem(NICKNAME_STORAGE_KEY);
      router.replace("/");
      return;
    }

    setNickname(cleaned);
  }, [router]);

  const greeting = useMemo(() => {
    if (!nickname) return "";
    return t("welcome", { nickname });
  }, [nickname, t]);

  if (!nickname) {
    return (
      <main className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center justify-center px-5 py-12">
          <div className="text-sm text-muted-foreground">{t("loading")}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{t("title")}</p>
                <h1 className="mt-1 font-mono text-2xl tracking-tight" data-testid="lobby-title">
                  {greeting}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {t("editNickname")}
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                data-testid="nav-quick-match"
                disabled
                className="flex h-14 items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 text-left text-sm font-medium text-foreground/60 shadow-sm"
              >
                <span>{t("quickMatch")}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t("quickMatchHint")}
                </span>
              </button>

              <button
                type="button"
                data-testid="nav-create-room"
                onClick={() => router.push("/room/create")}
                className="group flex h-14 items-center justify-between rounded-2xl border border-border bg-background/60 px-4 text-left text-sm font-medium shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{t("createRoom")}</span>
                <span className="font-mono text-xs text-muted-foreground transition group-hover:text-foreground/80">
                  /room/create
                </span>
              </button>

              <button
                type="button"
                data-testid="nav-join-room"
                onClick={() => router.push("/room/join")}
                className="group flex h-14 items-center justify-between rounded-2xl border border-border bg-background/60 px-4 text-left text-sm font-medium shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{t("joinRoom")}</span>
                <span className="font-mono text-xs text-muted-foreground transition group-hover:text-foreground/80">
                  /room/join
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
