import { CLIENT_MESSAGE_TYPES, RECONNECT_GRACE_SECONDS } from "@rps/contracts";
import { type Client, type Delayed, Room } from "colyseus";

import {
  areAllPlayersChosen,
  assignRandomChoices,
  clearPlayerChoices,
  determineRoundWinner,
  getWinThreshold,
  isChoiceMessage,
  isSelectModeMessage,
  isValidChoice,
  isValidMode,
} from "./domain/match-flow";
import {
  areAllPlayersRematchReady,
  clearPlayerRematchReady,
  markPlayerRematchReady,
  resetPlayersForLobby,
} from "./domain/rematch-flow";
import {
  LOBBY_GAME_STATUS,
  nextHostSessionId,
  sanitizeNickname,
  shouldAllowGracefulReconnection,
  shouldFinalizeRoundByForfeit,
  syncRoomLock,
} from "./domain/room-lifecycle";
import { PlayerState, RpsRoomState } from "./schema/RpsRoomState";

export class RpsRoom extends Room<RpsRoomState> {
  maxClients = 2;
  private countdownInterval: Delayed | null = null;
  private resultTimeout: Delayed | null = null;

  onCreate(_options: unknown): void {
    this.setState(new RpsRoomState());

    this.onMessage(CLIENT_MESSAGE_TYPES.SELECT_MODE, (client, message: unknown) => {
      if (this.state.gameStatus !== LOBBY_GAME_STATUS) return;
      if (this.clients.length !== this.maxClients) return;
      if (client.sessionId !== this.state.hostSessionId) return;
      if (!isSelectModeMessage(message)) return;
      if (!isValidMode(message.mode)) return;

      this.state.gameMode = message.mode;
      this.startChoosingPhase();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.CHOICE, (client, message: unknown) => {
      if (this.state.gameStatus !== "choosing") return;
      if (!isChoiceMessage(message)) return;
      if (!isValidChoice(message.choice)) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.choice !== "") return;

      player.choice = message.choice;
      this.checkBothPlayersChosen();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_READY, (client) => {
      if (this.state.gameStatus !== "finished") return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      markPlayerRematchReady(player);
      this.maybeResetToLobby();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_CANCEL, (client) => {
      if (this.state.gameStatus !== "finished") return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      clearPlayerRematchReady(player);
    });
  }

  private startChoosingPhase(): void {
    this.state.gameStatus = "choosing";
    this.state.countdown = 10;

    this.countdownInterval = this.clock.setInterval(() => {
      this.state.countdown -= 1;

      if (this.state.countdown <= 0) {
        this.stopCountdown();
        assignRandomChoices(this.state.players.values());
        this.determineWinner();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (!this.countdownInterval) return;

    this.countdownInterval.clear();
    this.countdownInterval = null;
  }

  private stopResultTimeout(): void {
    if (!this.resultTimeout) return;

    this.resultTimeout.clear();
    this.resultTimeout = null;
  }

  private scheduleResultTimeout(delayMs = 3000): void {
    this.stopResultTimeout();
    this.resultTimeout = this.clock.setTimeout(() => {
      this.resultTimeout = null;
      this.handleRoundEnd();
    }, delayMs);
  }

  private syncRoomLock(): void {
    syncRoomLock(this, this.state.players.size);
  }

  private maybeResetToLobby(): void {
    if (this.state.gameStatus !== "finished") return;
    if (this.state.players.size !== 2) return;
    if (!areAllPlayersRematchReady(this.state.players.values())) return;

    this.resetMatchState();
  }

  private resetMatchState(): void {
    this.stopResultTimeout();
    this.stopCountdown();

    resetPlayersForLobby(this.state.players.values());

    this.state.roundNumber = 1;
    this.state.winner = "";
    this.state.countdown = 0;
    this.state.gameMode = "";
    this.state.gameStatus = this.state.players.size === 2 ? LOBBY_GAME_STATUS : "waiting";
    this.syncRoomLock();
  }

  private checkBothPlayersChosen(): void {
    if (this.state.players.size !== 2) return;
    if (!areAllPlayersChosen(this.state.players.values())) return;

    this.stopCountdown();
    this.determineWinner();
  }

  private determineWinner(): void {
    const players = Array.from(this.state.players.values());
    if (players.length < 2) return;

    this.state.winner = determineRoundWinner(players);
    this.state.gameStatus = "result";
    this.scheduleResultTimeout();
  }

  private resumeChoosingCountdown(): void {
    if (this.state.gameStatus !== "choosing") return;
    if (this.countdownInterval) return;
    if (this.state.players.size !== 2) return;

    if (this.state.countdown <= 0) {
      assignRandomChoices(this.state.players.values());
      this.determineWinner();
      return;
    }

    this.countdownInterval = this.clock.setInterval(() => {
      this.state.countdown -= 1;

      if (this.state.countdown <= 0) {
        this.stopCountdown();
        assignRandomChoices(this.state.players.values());
        this.determineWinner();
      }
    }, 1000);
  }

  private finalizePlayerLeave(sessionId: string): void {
    if (shouldFinalizeRoundByForfeit(this.state.gameStatus, this.state.players.size)) {
      this.stopCountdown();

      const remainingPlayer = Array.from(this.state.players.values()).find(
        (player) => player.sessionId !== sessionId,
      );

      if (remainingPlayer) {
        this.state.winner = remainingPlayer.sessionId;
        this.state.gameStatus = "finished";
      }
    }

    this.state.players.delete(sessionId);

    if (this.state.players.size === 0) {
      this.resetMatchState();
      this.state.hostSessionId = "";
      return;
    }

    if (!this.state.players.has(this.state.hostSessionId)) {
      this.state.hostSessionId = nextHostSessionId(this.state.players.values());
    }

    this.syncRoomLock();
  }

  private handleRoundEnd(): void {
    const winThreshold = getWinThreshold(this.state.gameMode);
    const players = Array.from(this.state.players.values());
    const gameWinner = players.find((player) => player.score >= winThreshold);

    if (gameWinner) {
      this.state.gameStatus = "finished";
      this.state.winner = gameWinner.sessionId;
      return;
    }

    clearPlayerChoices(players);
    this.state.roundNumber += 1;
    this.state.winner = "";
    this.startChoosingPhase();
  }

  onJoin(client: Client, options: unknown): void {
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.nickname = sanitizeNickname((options as Record<string, unknown> | null)?.nickname);

    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.state.hostSessionId = client.sessionId;
    } else if (this.state.hostSessionId === "") {
      this.state.hostSessionId = nextHostSessionId(this.state.players.values());
    }

    if (this.state.players.size === this.maxClients) {
      this.resetMatchState();
      return;
    }

    this.syncRoomLock();
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const canReconnect = shouldAllowGracefulReconnection({
      consented,
      playerCount: this.state.players.size,
      gameStatus: this.state.gameStatus,
    });
    const statusBeforeLeave = this.state.gameStatus;

    this.stopResultTimeout();
    if (statusBeforeLeave === "choosing") {
      this.stopCountdown();
    }

    if (canReconnect) {
      try {
        await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);

        if (this.state.gameStatus === "choosing") {
          this.resumeChoosingCountdown();
        } else if (this.state.gameStatus === "result") {
          this.scheduleResultTimeout();
        } else {
          this.syncRoomLock();
        }

        return;
      } catch {
        // reconnect timeout/invalid token -> finalize leave below
      }
    }

    this.finalizePlayerLeave(client.sessionId);
  }

  onDispose(): void {
    this.stopResultTimeout();
    this.stopCountdown();
    console.log("room", this.roomId, "disposing...");
  }
}
