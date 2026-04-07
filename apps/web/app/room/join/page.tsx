"use client";
import type { Room } from "colyseus.js";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { joinRoomById } from "@/lib/colyseus-client";
import { NICKNAME_STORAGE_KEY } from "@/lib/nickname";
import { readStoredNicknameResolution } from "@/lib/nickname-session";
import { resolveJoinRoomErrorKey } from "@/lib/room-errors";
import { safeLeave } from "@/lib/safe-leave";
import { isActionBlockedByLeaveError, useGameStore } from "@/store/game-store";

export default function JoinRoomPage() {
  const router = useRouter();
  const t = useTranslations("room");
  const tGame = useTranslations("game");
  const tHome = useTranslations("home");
  const setRoom = useGameStore((s) => s.setRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const leaveError = useGameStore((s) => s.leaveError);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const roomRef = useRef<Room | null>(null);
  const transferredRef = useRef(false);

  const [nickname, setNickname] = useState<string | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const {
      nickname: savedNickname,
      shouldClear,
      shouldRedirectHome,
    } = readStoredNicknameResolution();
    if (shouldRedirectHome) {
      if (shouldClear) window.localStorage.removeItem(NICKNAME_STORAGE_KEY);
      router.replace("/");
      return;
    }

    setNickname(savedNickname);
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const current = roomRef.current;
      roomRef.current = null;
      if (current && !transferredRef.current) void leaveRoom();
    };
  }, [leaveRoom]);

  const validationMessage = useMemo(() => {
    if (!touched) return null;
    if (roomIdInput.trim().length === 0) return t("join.roomIdRequired");
    return null;
  }, [roomIdInput, touched, t]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!nickname) return;

    const previous = roomRef.current;
    roomRef.current = null;
    if (previous) {
      void leaveRoom();
    }

    const roomId = roomIdInput.trim();
    if (!roomId) {
      inputRef.current?.focus();
      return;
    }

    setJoining(true);
    try {
      const joined = await joinRoomById(roomId, { nickname });

      if (!mountedRef.current) {
        void safeLeave(joined);
        return;
      }

      roomRef.current = joined;
      setRoom(joined);

      transferredRef.current = true;
      router.replace(`/room/${joined.roomId}`);
    } catch (err) {
      if (mountedRef.current) setError(tGame(resolveJoinRoomErrorKey(err) as never));
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  }

  const headerLine = t("join.subtitle");

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{t("title")}</p>
                <h1 className="mt-1 font-mono text-2xl tracking-tight">{t("join.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{headerLine}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void leaveRoom().finally(() => router.push("/menu"));
                }}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {t("status.back")}
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <div className="space-y-2">
                <label htmlFor="roomId" className="text-xs font-medium text-muted-foreground">
                  {t("code.label")}
                </label>
                <input
                  ref={inputRef}
                  id="roomId"
                  name="roomId"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder={t("code.placeholder")}
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                  data-testid="roomid-input"
                  className="h-12 w-full rounded-xl border border-border bg-card px-4 font-mono text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
                {validationMessage ? (
                  <p className="text-xs text-destructive">{validationMessage}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("join.roomIdHint")}</p>
                )}
              </div>

              <button
                type="submit"
                data-testid="join-submit"
                disabled={
                  joining || !nickname || isActionBlockedByLeaveError("join-submit", leaveError)
                }
                className="inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{joining ? t("join.submitLoading") : t("join.submit")}</span>
                <span className="font-mono text-xs opacity-70">{tHome("enterHint")}</span>
              </button>
            </form>

            {error ? (
              <p data-testid="room-error" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {leaveError ? (
              <p className="mt-4 text-sm text-destructive">{tGame(leaveError as never)}</p>
            ) : null}

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
