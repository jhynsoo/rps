"use client";

import type { Room } from "colyseus.js";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { joinRoomById } from "@/lib/colyseus-client";
import { useGameStore } from "@/store/game-store";

const NICKNAME_STORAGE_KEY = "rps:nickname";

function sanitizeNickname(raw: string) {
  return raw.trim().slice(0, 12);
}

function formatJoinError(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.trim();
  if (!msg) return "Failed to join room.";

  if (/full|maxClients|seat|locked/i.test(msg)) return "Room is full.";
  if (/not found|roomId|invalid|no such/i.test(msg)) return "Room not found.";
  if (/connect|websocket|network|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
    return "Server is unavailable.";
  }

  return msg;
}

export default function JoinRoomPage() {
  const router = useRouter();
  const setRoom = useGameStore((s) => s.setRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const roomVersion = useGameStore((s) => s.roomVersion);
  const leaveError = useGameStore((s) => s.leaveError);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const roomRef = useRef<Room | null>(null);
  const transferredRef = useRef(false);

  const [nickname, setNickname] = useState<string | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [joining, setJoining] = useState(false);
  const [room, setRoomLocal] = useState<Room | null>(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      mountedRef.current = false;
      const current = roomRef.current;
      roomRef.current = null;
      if (current && !transferredRef.current) void leaveRoom();
    };
  }, [leaveRoom]);

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

  const validationMessage = useMemo(() => {
    if (!touched) return null;
    if (roomIdInput.trim().length === 0) return "Room code is required";
    return null;
  }, [roomIdInput, touched]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!nickname) return;

    const previous = roomRef.current;
    roomRef.current = null;
    if (previous) {
      void leaveRoom();
      setRoomLocal(null);
      setPlayersCount(0);
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
        void joined.leave();
        return;
      }

      roomRef.current = joined;
      setRoomLocal(joined);
      setRoom(joined);
    } catch (err) {
      if (mountedRef.current) setError(formatJoinError(err));
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  }

  const headerLine = useMemo(() => {
    if (!room) return "Enter a room code to join.";
    if (playersCount < 2) return "Joined. Waiting for host...";
    return "Joined.";
  }, [playersCount, room]);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  Private Room
                </p>
                <h1 className="mt-1 font-mono text-2xl tracking-tight">
                  Join room
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {headerLine}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void leaveRoom().finally(() => router.push("/lobby"));
                }}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                Back
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="roomId"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Room code
                </label>
                <input
                  ref={inputRef}
                  id="roomId"
                  name="roomId"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. Y6s9mE9J"
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                  data-testid="roomid-input"
                  className="h-12 w-full rounded-xl border border-border bg-card px-4 font-mono text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
                {validationMessage ? (
                  <p className="text-xs text-destructive">
                    {validationMessage}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Leading/trailing spaces are ignored.
                  </p>
                )}
              </div>

              <button
                type="submit"
                data-testid="join-submit"
                disabled={joining || !nickname || !!room}
                className="inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{joining ? "Joining..." : "Join"}</span>
                <span className="font-mono text-xs opacity-70">Enter</span>
              </button>
            </form>

            {error ? (
              <p
                data-testid="room-error"
                className="mt-4 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {leaveError ? (
              <p className="mt-4 text-sm text-destructive">{leaveError}</p>
            ) : null}

            {room ? (
              <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Joined room
                </p>
                <p className="mt-1 font-mono text-lg">{room.roomId}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Players:{" "}
                  <span className="text-foreground">{playersCount}/2</span>
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!room || !!error || !!leaveError}
              onClick={() => {
                if (!room) return;
                transferredRef.current = true;
                router.push(`/room/${room.roomId}`);
              }}
              className="mt-4 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Continue</span>
              <span className="font-mono text-xs opacity-70">
                /room/{room?.roomId ?? "-"}
              </span>
            </button>

            {nickname ? (
              <p className="mt-4 text-xs text-muted-foreground">
                You are{" "}
                <span className="font-mono text-foreground">{nickname}</span>.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
