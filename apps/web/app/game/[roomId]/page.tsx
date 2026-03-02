"use client";

import type { Room } from "colyseus.js";
import { CLIENT_MESSAGE_TYPES, type PlayerStateView, type RoomStateView } from "@rps/contracts";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { RpsChoice } from "@/lib/rps";
import { gameModeMessage, gameStatusMessage, rpsChoiceMessage } from "@/lib/rps-i18n";
import { useRoomStateVersion } from "@/lib/use-room-state-version";
import { isActionBlockedByLeaveError, useGameStore } from "@/store/game-store";

type PlayerLike = PlayerStateView;
type MyRoomStateLike = Pick<
  RoomStateView,
  "players" | "gameStatus" | "gameMode" | "countdown" | "winner" | "roundNumber"
>;

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

function getWinnerLabel(winner: string, players: PlayerLike[], drawLabel: string) {
  if (!winner) return "";
  if (winner === "draw") return drawLabel;
  const p = players.find((x) => x.sessionId === winner);
  return p?.nickname || winner.slice(0, 6);
}

export default function GamePage() {
  const tGame = useTranslations("game");
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? tGame(key as never, values as never) : tGame(key as never);

  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId ?? "";

  const room = useGameStore((s) => s.room);
  const storeRoomId = useGameStore((s) => s.roomId);
  const leaveError = useGameStore((s) => s.leaveError);
  const reconnectState = useGameStore((s) => s.reconnectState);
  const reconnectError = useGameStore((s) => s.reconnectError);
  const attemptReconnect = useGameStore((s) => s.attemptReconnect);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  useRoomStateVersion(room);

  const state = getState(room);
  const isMismatch = !!storeRoomId && storeRoomId !== roomId;

  const players = state ? Array.from(state.players.values()) : [];
  const self = room ? (players.find((p) => p.sessionId === room.sessionId) ?? null) : null;

  const gameStatus = state?.gameStatus ?? "";
  const selfChoice = self?.choice ?? "";
  const selfReady = self?.isReady ?? false;
  const gameStatusLabel = translateMessage(t, gameStatusMessage(gameStatus));
  const gameModeLabel = state ? translateMessage(t, gameModeMessage(state.gameMode)) : "";

  const [choiceSent, setChoiceSent] = useState<RpsChoice | null>(null);
  const reconnectAttemptedRef = useRef(false);

  const hadTwoPlayersRef = useRef(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  useEffect(() => {
    if (gameStatus !== "mode_select") return;
    if (!roomId) return;
    router.replace(`/room/${roomId}`);
  }, [gameStatus, roomId, router]);

  useEffect(() => {
    if (room) return;
    if (!roomId) return;
    if (storeRoomId && storeRoomId !== roomId) return;
    if (reconnectAttemptedRef.current) return;

    reconnectAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      void attemptReconnect(roomId);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [attemptReconnect, room, roomId, storeRoomId]);

  useEffect(() => {
    if (gameStatus !== "choosing") return;
    if (selfChoice !== "") return;
    setChoiceSent(null);
  }, [gameStatus, selfChoice]);

  useEffect(() => {
    const size = state?.players.size ?? 0;
    if (size === 2) {
      hadTwoPlayersRef.current = true;
      setOpponentLeft(false);
    }
    if (size === 1 && hadTwoPlayersRef.current) setOpponentLeft(true);
  }, [state?.players.size]);

  async function onBackToLobby() {
    try {
      await leaveRoom();
    } finally {
      router.push("/lobby");
    }
  }

  function choiceLabel(choice: string) {
    return translateMessage(t, rpsChoiceMessage(choice));
  }

  if (!room && reconnectState === "trying" && !isMismatch) {
    return (
      <main className="min-h-dvh bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
              <p className="font-mono text-xs text-muted-foreground">{t("title")}</p>
              <h1 className="mt-1 font-mono text-2xl tracking-tight">{t("reconnecting")}</h1>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!room || !state || isMismatch) {
    const title = !room
      ? t("errorNoActiveRoom")
      : isMismatch
        ? t("errorMismatch")
        : t("errorUnavailable");
    const detail = !room
      ? reconnectError === "expired"
        ? t("detailReconnectExpired")
        : t("detailNeedsReconnect")
      : isMismatch
        ? t("detailMismatch", { activeRoomId: storeRoomId ?? "-", urlRoomId: roomId || "-" })
        : t("detailMissingState");

    return (
      <main className="min-h-dvh bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
              <p className="font-mono text-xs text-muted-foreground">{t("title")}</p>
              <h1 className="mt-1 font-mono text-2xl tracking-tight">{title}</h1>
              <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
              <button
                type="button"
                onClick={() => {
                  void onBackToLobby();
                }}
                className="mt-6 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{t("backToLobby")}</span>
                <span className="font-mono text-xs opacity-70">/lobby</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const readyCount = players.filter((p) => p.isReady).length;
  const totalPlayers = state.players.size;
  const roundWinnerLabel = getWinnerLabel(state.winner, players, t("errors.draw"));
  const isMultiRound = state.gameMode === "best_of_3" || state.gameMode === "best_of_5";

  const activeRoom = room;

  const canChoose =
    !isActionBlockedByLeaveError("choice-rock", leaveError) &&
    gameStatus === "choosing" &&
    !!self &&
    selfChoice === "" &&
    choiceSent === null;

  function sendChoice(choice: RpsChoice) {
    if (!canChoose) return;
    setChoiceSent(choice);
    activeRoom.send(CLIENT_MESSAGE_TYPES.CHOICE, { choice });
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
                <h1 className="mt-1 font-mono text-2xl tracking-tight">
                  {t("roundLabel")} {state.roundNumber}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("statusLabel")}: <span className="text-foreground">{gameStatusLabel}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("modeLabel")}: <span className="text-foreground">{gameModeLabel}</span>
                </p>
              </div>
              <button
                type="button"
                data-testid="back-to-room"
                onClick={() => router.push(`/room/${roomId}`)}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {t("backToRoom")}
              </button>
            </div>

            {leaveError ? (
              <p className="mt-4 text-sm text-destructive">{tGame(leaveError as never)}</p>
            ) : null}

            {!leaveError && opponentLeft ? (
              <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
                <p className="font-mono text-xs text-muted-foreground">{t("statusLabel")}</p>
                <p className="mt-1 text-sm text-foreground">{t("opponentLeft")}</p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">{t("countdownLabel")}</p>
                <p data-testid="countdown" className="mt-1 font-mono text-3xl tracking-tight">
                  {state.countdown}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">{t("yourChoiceLabel")}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    data-testid="choice-rock"
                    disabled={!canChoose}
                    onClick={() => sendChoice("rock")}
                    className="h-12 rounded-xl border border-border bg-card px-2 text-sm font-medium shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {choiceLabel("rock")}
                  </button>
                  <button
                    type="button"
                    data-testid="choice-paper"
                    disabled={!canChoose}
                    onClick={() => sendChoice("paper")}
                    className="h-12 rounded-xl border border-border bg-card px-2 text-sm font-medium shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {choiceLabel("paper")}
                  </button>
                  <button
                    type="button"
                    data-testid="choice-scissors"
                    disabled={!canChoose}
                    onClick={() => sendChoice("scissors")}
                    className="h-12 rounded-xl border border-border bg-card px-2 text-sm font-medium shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {choiceLabel("scissors")}
                  </button>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {selfChoice
                    ? t("state.locked", { choice: choiceLabel(selfChoice) })
                    : choiceSent
                      ? t("state.sending", { choice: choiceLabel(choiceSent) })
                      : gameStatus === "choosing"
                        ? t("state.pickOne")
                        : t("state.waitNextRound")}
                </p>
              </div>

              {gameStatus === "result" ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t("roundResult")}</p>
                  <p data-testid="round-winner" className="mt-2 font-mono text-lg">
                    {roundWinnerLabel ? t("state.winner", { winner: roundWinnerLabel }) : ""}
                  </p>
                </div>
              ) : null}

              {gameStatus === "finished" ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t("matchResult")}</p>
                  <p data-testid="match-winner" className="mt-2 font-mono text-lg">
                    {roundWinnerLabel ? t("state.winner", { winner: roundWinnerLabel }) : ""}
                  </p>
                </div>
              ) : null}

              {isMultiRound ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t("scoreLabel")}</p>
                  <div className="mt-3 grid gap-2">
                    {players.map((p) => (
                      <div key={p.sessionId} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-sm">
                          {p.nickname || t("playerFallback")}
                        </span>
                        <span className="font-mono text-sm">{p.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("rematchLabel")}</p>
                    <p data-testid="rematch-status" className="mt-1 text-sm text-muted-foreground">
                      {t("state.readyCount", { ready: readyCount, total: totalPlayers })}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="rematch-ready"
                    disabled={
                      isActionBlockedByLeaveError("rematch-ready", leaveError) ||
                      gameStatus !== "finished" ||
                      !self
                    }
                    onClick={() => {
                      if (gameStatus !== "finished" || !self) return;
                      activeRoom.send(
                        selfReady
                          ? CLIENT_MESSAGE_TYPES.REMATCH_CANCEL
                          : CLIENT_MESSAGE_TYPES.REMATCH_READY,
                      );
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-medium shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50"
                  >
                    {selfReady ? t("cancel") : t("ready")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
