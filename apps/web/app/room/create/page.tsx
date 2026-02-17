"use client";

import type { Room } from "colyseus.js";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { createRoom } from "@/lib/colyseus-client";
import { useGameStore } from "@/store/game-store";

const NICKNAME_STORAGE_KEY = "rps:nickname";

function sanitizeNickname(raw: string) {
  return raw.trim().slice(0, 12);
}

export default function CreateRoomPage() {
  const router = useRouter();
  const t = useTranslations("room");
  const tGame = useTranslations("game");
  const setRoom = useGameStore((s) => s.setRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const roomVersion = useGameStore((s) => s.roomVersion);
  const leaveError = useGameStore((s) => s.leaveError);

  const [nickname, setNickname] = useState<string | null>(null);
  const [room, setRoomLocal] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const transferredRef = useRef(false);
  const [playersCount, setPlayersCount] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    void roomVersion;
    const state = room.state as
      | {
          players?: {
            size?: number;
          };
        }
      | undefined;
    setPlayersCount(state?.players?.size ?? 0);
  }, [room, roomVersion]);

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

  useEffect(() => {
    if (!nickname) return;

    const nick = nickname;

    let active = true;
    setError(null);

    async function run() {
      try {
        const created = await createRoom({ nickname: nick });
        if (!active) {
          void created.leave();
          return;
        }

        roomRef.current = created;
        setRoomLocal(created);
        setRoom(created);

        transferredRef.current = true;
        router.replace(`/room/${created.roomId}`);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : t("create.failed"));
      }
    }

    void run();

    return () => {
      active = false;
      const current = roomRef.current;
      roomRef.current = null;

      if (current && !transferredRef.current) void leaveRoom();
    };
  }, [nickname, leaveRoom, router, setRoom, t]);

  const roomId = room?.roomId ?? "";
  const statusLine = useMemo(() => {
    if (error || leaveError) return "";
    if (!room) return t("status.creating");
    if (playersCount < 2) return t("status.waiting");
    return t("status.opponentJoined");
  }, [error, leaveError, playersCount, room, t]);

  async function onCopy() {
    if (!roomId) return;
    setCopyFeedback(null);

    try {
      await navigator.clipboard.writeText(roomId);
      setCopyFeedback(t("code.copySuccess"));
      window.setTimeout(() => setCopyFeedback(null), 1200);
    } catch {
      setCopyFeedback(t("code.copyFail"));
      window.setTimeout(() => setCopyFeedback(null), 1200);
    }
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
                <h1 className="mt-1 font-mono text-2xl tracking-tight">{t("create.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("create.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void leaveRoom().finally(() => router.push("/lobby"));
                }}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {t("status.back")}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t("code.label")}</p>
                  <p data-testid="roomid-display" className="mt-1 truncate font-mono text-lg">
                    {roomId || "-"}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="roomid-copy"
                  onClick={onCopy}
                  disabled={!roomId}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-medium shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50"
                >
                  {copyFeedback ?? t("code.copy")}
                </button>
              </div>

              <div className="mt-4 grid gap-1 text-sm">
                <p className="text-muted-foreground">
                  {t("code.players")}: <span className="text-foreground">{playersCount}/2</span>
                </p>
                {error ? (
                  <p className="text-destructive">{error}</p>
                ) : leaveError ? (
                  <p className="text-destructive">{tGame(leaveError as never)}</p>
                ) : (
                  <p className="text-muted-foreground">{statusLine}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!roomId || !!error || !!leaveError}
              onClick={() => {
                if (!roomId) return;
                transferredRef.current = true;
                router.push(`/room/${roomId}`);
              }}
              className="mt-4 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{t("create.continue")}</span>
              <span className="font-mono text-xs opacity-70">/room/{roomId || "-"}</span>
            </button>

            {nickname ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t("create.youAre")} <span className="font-mono text-foreground">{nickname}</span>.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
