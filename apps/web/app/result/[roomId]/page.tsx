"use client";

import { CLIENT_MESSAGE_TYPES, type PlayerStateView, type RoomStateView } from "@rps/contracts";
import type { Room } from "colyseus.js";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { resolveContractErrorMessageKey } from "@/lib/error-contract";
import { gameModeMessage, gameStatusMessage } from "@/lib/rps-i18n";
import { resolveRoomRouteGuard } from "@/lib/room-route-guard";
import { useRoomStateVersion } from "@/lib/use-room-state-version";
import { isActionBlockedByLeaveError, useGameStore } from "@/store/game-store";

type PlayerLike = PlayerStateView;
type MyRoomStateLike = Pick<
  RoomStateView,
  "players" | "gameStatus" | "gameMode" | "winner" | "roundNumber"
>;
type PlayersCollectionLike = {
  size: number;
  values: () => IterableIterator<PlayerLike>;
};

function getState(room: Room | null): MyRoomStateLike | null {
  if (!room) return null;
  return room.state as MyRoomStateLike;
}

function hasPlayersCollection(value: unknown): value is PlayersCollectionLike {
  if (typeof value !== "object" || value === null) return false;
  const maybe = value as { size?: unknown; values?: unknown };
  return typeof maybe.size === "number" && typeof maybe.values === "function";
}

function getRenderableState(state: MyRoomStateLike | null): MyRoomStateLike | null {
  if (!state) return null;
  if (!hasPlayersCollection((state as { players?: unknown }).players)) return null;
  return state;
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

export default function ResultPage() {
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

  const state = getRenderableState(getState(room));
  const gameStatus = state?.gameStatus ?? "";
  const routeGuard = resolveRoomRouteGuard({
    page: "result",
    roomId,
    room,
    storeRoomId,
    hasRenderableState: !!state,
    gameStatus,
    reconnectState,
    reconnectError,
  });

  const players = state ? Array.from(state.players.values()) : [];
  const self = room ? (players.find((p) => p.sessionId === room.sessionId) ?? null) : null;
  const opponent = room ? (players.find((p) => p.sessionId !== room.sessionId) ?? null) : null;

  const gameStatusLabel = translateMessage(t, gameStatusMessage(gameStatus));
  const gameModeLabel = state ? translateMessage(t, gameModeMessage(state.gameMode)) : "";

  const reconnectAttemptedRef = useRef(false);

  useEffect(() => {
    if (routeGuard.kind !== "state_redirect") return;
    router.replace(routeGuard.to);
  }, [routeGuard.kind, routeGuard.kind === "state_redirect" ? routeGuard.to : "", router]);

  useEffect(() => {
    if (room) return;
    if (!roomId) return;
    if (routeGuard.kind === "mismatch") return;
    if (reconnectAttemptedRef.current) return;

    reconnectAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      void attemptReconnect(roomId);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [attemptReconnect, room, roomId, routeGuard.kind]);

  async function onBackToMenu() {
    try {
      await leaveRoom();
    } finally {
      router.push("/menu");
    }
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
                  void onBackToMenu();
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

  const selfReady = self?.isReady ?? false;
  const opponentReady = opponent?.isReady ?? false;
  const readyCount = players.filter((p) => p.isReady).length;
  const totalPlayers = state.players.size;
  const winnerLabel = getWinnerLabel(state.winner, players, t("errors.draw"));
  const isFinished = gameStatus === "finished";

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,oklch(0.97_0_0)_0%,transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{t("title")}</p>
                <h1 className="mt-1 font-mono text-2xl tracking-tight">{t("result.title")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("statusLabel")}: <span className="text-foreground">{gameStatusLabel}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("modeLabel")}: <span className="text-foreground">{gameModeLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void onBackToMenu();
                }}
                className="h-9 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-background"
              >
                {t("backToLobby")}
              </button>
            </div>

            {leaveError ? (
              <p className="mt-4 text-sm text-destructive">{t(leaveError as never)}</p>
            ) : null}

            {!leaveError && lastErrorEnvelope ? (
              <p className="mt-4 text-sm text-destructive">
                {t(resolveContractErrorMessageKey(lastErrorEnvelope.code) as never)}
              </p>
            ) : null}

            <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("result.roomLabel")}</p>
              <p className="mt-1 font-mono text-lg">{roomId || "-"}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("roundLabel")} {state.roundNumber}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("roundResult")}</p>
              <p data-testid="round-winner" className="mt-2 font-mono text-lg">
                {winnerLabel ? t("state.winner", { winner: winnerLabel }) : ""}
              </p>
            </div>

            {isFinished ? (
              <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">{t("matchResult")}</p>
                <p data-testid="match-winner" className="mt-2 font-mono text-lg">
                  {winnerLabel ? t("state.winner", { winner: winnerLabel }) : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("rematchLabel")}</p>
                  <p data-testid="rematch-status" className="mt-1 text-sm text-muted-foreground">
                    {t("state.readyCount", { ready: readyCount, total: totalPlayers })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {opponentReady
                      ? t("result.opponentAgreement.accepted")
                      : t("result.opponentAgreement.waiting")}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="rematch-ready"
                  disabled={
                    isActionBlockedByLeaveError("rematch-ready", leaveError) ||
                    !isFinished ||
                    !self ||
                    !room
                  }
                  onClick={() => {
                    if (!isFinished || !self || !room) return;
                    room.send(
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
    </main>
  );
}
