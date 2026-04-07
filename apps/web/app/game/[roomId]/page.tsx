"use client";

import { CLIENT_MESSAGE_TYPES, type PlayerStateView, type RoomStateView } from "@rps/contracts";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { resolveContractErrorMessageKey } from "@/lib/error-contract";
import { translateMessage } from "@/lib/message-descriptor";
import { resolveRoomRouteGuard } from "@/lib/room-route-guard";
import {
  buildScoreSummaries,
  findPlayerBySessionId,
  getRenderableRoomState,
  materializePlayers,
} from "@/lib/room-view";
import type { RpsChoice } from "@/lib/rps";
import { gameModeMessage, gameStatusMessage, rpsChoiceMessage } from "@/lib/rps-i18n";
import {
  useDelayedReconnectAttempt,
  useOpponentLeftState,
  useRouteGuardRedirect,
} from "@/lib/use-room-page-effects";
import { useRoomStateVersion } from "@/lib/use-room-state-version";
import { isActionBlockedByLeaveError, useGameStore } from "@/store/game-store";

type MyRoomStateLike = Pick<
  RoomStateView,
  "players" | "gameStatus" | "gameMode" | "countdown" | "winner" | "roundNumber"
>;

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
  const lastErrorEnvelope = useGameStore((s) => s.lastErrorEnvelope);
  const reconnectState = useGameStore((s) => s.reconnectState);
  const reconnectError = useGameStore((s) => s.reconnectError);
  const attemptReconnect = useGameStore((s) => s.attemptReconnect);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  useRoomStateVersion(room);

  const state = getRenderableRoomState<MyRoomStateLike>(room);
  const gameStatus = state?.gameStatus ?? "";
  const routeGuard = resolveRoomRouteGuard({
    page: "game",
    roomId,
    room,
    storeRoomId,
    hasRenderableState: !!state,
    gameStatus,
    reconnectState,
    reconnectError,
  });

  const players = materializePlayers<PlayerStateView>(state?.players);
  const self = findPlayerBySessionId(players, room?.sessionId);
  const scoreSummaries = buildScoreSummaries(players, t("playerFallback"));

  const selfChoice = self?.choice ?? "";
  const gameStatusLabel = translateMessage(t, gameStatusMessage(gameStatus));
  const gameModeLabel = state ? translateMessage(t, gameModeMessage(state.gameMode)) : "";

  const [choiceSent, setChoiceSent] = useState<RpsChoice | null>(null);
  const opponentLeft = useOpponentLeftState(state?.players.size ?? 0);

  useRouteGuardRedirect(routeGuard, router.replace);
  useDelayedReconnectAttempt({
    room,
    roomId,
    routeGuardKind: routeGuard.kind,
    attemptReconnect,
  });

  useEffect(() => {
    if (gameStatus !== "choosing") return;
    if (selfChoice !== "") return;
    setChoiceSent(null);
  }, [gameStatus, selfChoice]);

  async function onBackToLobby() {
    try {
      await leaveRoom();
    } finally {
      router.push("/menu");
    }
  }

  function choiceLabel(choice: string) {
    return translateMessage(t, rpsChoiceMessage(choice));
  }

  if (routeGuard.kind === "reconnect_trying") {
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

  if (routeGuard.kind === "mismatch" || routeGuard.kind === "no_room") {
    const title =
      routeGuard.kind === "mismatch"
        ? t("errorMismatch")
        : room
          ? t("errorUnavailable")
          : t("errorNoActiveRoom");
    const detail =
      routeGuard.kind === "mismatch"
        ? t("detailMismatch", {
            activeRoomId: routeGuard.activeRoomId,
            urlRoomId: routeGuard.urlRoomId,
          })
        : t(`errors.${routeGuard.contractError}` as never);

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
                <span className="font-mono text-xs opacity-70">/menu</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return null;
  }

  const isMultiRound = state.gameMode === "best_of_3" || state.gameMode === "best_of_5";

  const canChoose =
    !isActionBlockedByLeaveError("choice-rock", leaveError) &&
    gameStatus === "choosing" &&
    !!room &&
    !!self &&
    selfChoice === "" &&
    choiceSent === null;

  function sendChoice(choice: RpsChoice) {
    if (!canChoose || !room) return;
    setChoiceSent(choice);
    room.send(CLIENT_MESSAGE_TYPES.CHOICE, { choice });
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

            {!leaveError && lastErrorEnvelope ? (
              <p className="mt-4 text-sm text-destructive">
                {tGame(resolveContractErrorMessageKey(lastErrorEnvelope.code) as never)}
              </p>
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

              {isMultiRound ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t("scoreLabel")}</p>
                  <div className="mt-3 grid gap-2">
                    {scoreSummaries.map((player) => (
                      <div
                        key={player.sessionId}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 truncate font-mono text-sm">
                          {player.nickname}
                        </span>
                        <span className="font-mono text-sm">{player.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
