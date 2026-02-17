"use client";

import type { Room } from "colyseus.js";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { GameMode } from "@/lib/rps";
import { gameStatusMessage } from "@/lib/rps-i18n";
import { useGameStore } from "@/store/game-store";

type PlayerLike = {
  sessionId: string;
  nickname: string;
  choice: string;
  score: number;
  isReady: boolean;
};

type MyRoomStateLike = {
  players: {
    size: number;
    values: () => IterableIterator<PlayerLike>;
  };
  hostSessionId: string;
  gameStatus: string;
  gameMode: string;
};

function getState(room: Room | null): MyRoomStateLike | null {
  if (!room) return null;
  return room.state as MyRoomStateLike;
}

type MessageDescriptor = {
  key: string;
  values?: Record<string, string | number>;
};

function translateMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  message: MessageDescriptor,
) {
  return message.values ? t(message.key, message.values) : t(message.key);
}

const MODES: Array<{ mode: GameMode; testId: string }> = [
  { mode: "single", testId: "mode-single" },
  { mode: "best_of_3", testId: "mode-bo3" },
  { mode: "best_of_5", testId: "mode-bo5" },
];

export default function RoomLobbyPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId ?? "";

  const tRoom = useTranslations("room");
  const tGame = useTranslations("game");
  const tGameMessage = (key: string, values?: Record<string, string | number>) =>
    values ? tGame(key as never, values as never) : tGame(key as never);

  const room = useGameStore((s) => s.room);
  const storeRoomId = useGameStore((s) => s.roomId);
  const roomVersion = useGameStore((s) => s.roomVersion);
  const leaveError = useGameStore((s) => s.leaveError);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  const state = getState(room);
  const isMismatch = !!storeRoomId && storeRoomId !== roomId;
  void roomVersion;

  const players = state ? Array.from(state.players.values()) : [];
  const isHost = !!room && !!state && room.sessionId === state.hostSessionId;

  const canControl = !!state && isHost && state.gameStatus === "mode_select";
  const [selectedMode, setSelectedMode] = useState<GameMode>("single");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const hadTwoPlayersRef = useRef(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const gameStatus = state?.gameStatus ?? "";

  useEffect(() => {
    const size = state?.players.size ?? 0;
    if (size === 2) {
      hadTwoPlayersRef.current = true;
      setOpponentLeft(false);
    }
    if (size === 1 && hadTwoPlayersRef.current) setOpponentLeft(true);
  }, [state?.players.size]);

  useEffect(() => {
    if (gameStatus !== "choosing") return;
    if (!roomId) return;
    router.replace(`/game/${roomId}`);
  }, [gameStatus, roomId, router]);

  async function onBackToLobby() {
    try {
      await leaveRoom();
    } finally {
      router.push("/lobby");
    }
  }

  async function onCopyRoomCode() {
    if (!roomId) return;
    setCopyFeedback(null);
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyFeedback(tRoom("code.copySuccess"));
      window.setTimeout(() => setCopyFeedback(null), 1200);
    } catch {
      setCopyFeedback(tRoom("code.copyFail"));
      window.setTimeout(() => setCopyFeedback(null), 1200);
    }
  }

  if (!room || !state || isMismatch) {
    const title = !room
      ? tRoom("waiting.errorNoActiveRoom")
      : isMismatch
        ? tRoom("waiting.errorMismatch")
        : tRoom("waiting.errorUnavailable");
    const detail = !room
      ? tRoom("waiting.detailNeedsReconnect")
      : isMismatch
        ? tGame("detailMismatch", { activeRoomId: storeRoomId ?? "-", urlRoomId: roomId || "-" })
        : tRoom("waiting.detailMissingState");

    return (
      <main className="min-h-dvh bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
              <p className="font-mono text-xs text-muted-foreground">{tRoom("waiting.title")}</p>
              <h1 className="mt-1 font-mono text-2xl tracking-tight">{title}</h1>
              <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
              <button
                type="button"
                onClick={() => {
                  void onBackToLobby();
                }}
                className="mt-6 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{tRoom("status.backToLobby")}</span>
                <span className="font-mono text-xs opacity-70">/lobby</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const gameStatusLabel = translateMessage(tGameMessage, gameStatusMessage(state.gameStatus));

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{tRoom("title")}</p>
                <h1 className="mt-1 font-mono text-2xl tracking-tight">{tRoom("waiting.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tGame("statusLabel")}: <span className="text-foreground">{gameStatusLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void onBackToLobby();
                }}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {tRoom("status.leave")}
              </button>
            </div>

            {leaveError ? (
              <p className="mt-4 text-sm text-destructive">{tGame(leaveError as never)}</p>
            ) : null}

            {!leaveError && opponentLeft ? (
              <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
                <p className="font-mono text-xs text-muted-foreground">{tGame("statusLabel")}</p>
                <p className="mt-1 text-sm text-foreground">{tGame("opponentLeft")}</p>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{tRoom("code.label")}</p>
                  <p className="mt-1 truncate font-mono text-lg">{roomId || "-"}</p>
                </div>
                <button
                  type="button"
                  onClick={onCopyRoomCode}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-medium shadow-sm transition enabled:hover:brightness-110"
                >
                  {copyFeedback ?? tRoom("code.copy")}
                </button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {tRoom("code.players")}:{" "}
                <span className="text-foreground">{state.players.size}/2</span>
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-medium text-muted-foreground">{tRoom("code.players")}</p>
              <ul
                data-testid="player-list"
                className="mt-3 grid gap-2 rounded-2xl border border-border bg-background/60 p-4"
              >
                {players.map((p) => {
                  const isHostPlayer = p.sessionId === state.hostSessionId;
                  return (
                    <li key={p.sessionId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-sm">
                        {p.nickname || tGame("playerFallback")}
                      </span>
                      <span className="flex items-center gap-2">
                        {isHostPlayer ? (
                          <span
                            data-testid="host-badge"
                            className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                          >
                            {tRoom("ready.hostBadge")}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {p.sessionId.slice(0, 4)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">{tRoom("ready.label")}</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {MODES.map((m) => {
                  const active = selectedMode === m.mode;
                  const disabled = !isHost;
                  return (
                    <button
                      key={m.mode}
                      type="button"
                      data-testid={m.testId}
                      disabled={disabled}
                      onClick={() => setSelectedMode(m.mode)}
                      className={
                        "h-10 rounded-xl border border-border px-2 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 " +
                        (active
                          ? "bg-foreground text-background"
                          : "bg-card text-foreground enabled:hover:brightness-110")
                      }
                    >
                      {tRoom(`ready.mode.${m.mode}` as never)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="start-game"
                disabled={!canControl}
                onClick={() => {
                  if (!canControl) return;
                  room.send("select_mode", { mode: selectedMode });
                }}
                className="mt-4 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{isHost ? tRoom("ready.start") : tRoom("ready.disabled")}</span>
                <span className="font-mono text-xs opacity-70">
                  {isHost ? tRoom("ready.actionSelectMode") : tRoom("ready.actionDisabled")}
                </span>
              </button>

              {!isHost ? (
                <p className="mt-3 text-xs text-muted-foreground">{tRoom("ready.hostOnly")}</p>
              ) : state.gameStatus !== "mode_select" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {tRoom("ready.waitingPlayers")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
