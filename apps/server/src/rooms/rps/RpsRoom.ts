import {
  ACTION_ERROR_CODES,
  type ActionErrorCode,
  CLIENT_MESSAGE_TYPES,
  type ErrorEnvelope,
  RECONNECT_GRACE_SECONDS,
  SERVER_MESSAGE_TYPES,
} from "@rps/contracts";
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
  CHOOSING_GAME_STATUS,
  FINISHED_GAME_STATUS,
  LOBBY_GAME_STATUS,
  nextHostSessionId,
  RESULT_GAME_STATUS,
  sanitizeNickname,
  shouldAllowGracefulReconnection,
  shouldFinalizeRoundByForfeit,
  syncRoomLock,
  WAITING_GAME_STATUS,
} from "./domain/room-lifecycle";
import { PlayerState, RpsRoomState } from "./schema/RpsRoomState";

export class RpsRoom extends Room<RpsRoomState> {
  maxClients = 2;
  private countdownInterval: Delayed | null = null;
  private resultTimeout: Delayed | null = null;

  private sendActionError(client: Client, code: ActionErrorCode, message: string): void {
    const error: ErrorEnvelope = {
      boundary: "action",
      code,
      message,
    };

    client.send(SERVER_MESSAGE_TYPES.ERROR, error);
  }

  onCreate(_options: unknown): void {
    this.setState(new RpsRoomState());

    this.onMessage(CLIENT_MESSAGE_TYPES.SELECT_MODE, (client, message: unknown) => {
      if (this.state.gameStatus !== LOBBY_GAME_STATUS) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_STATE,
          "Game mode can only be selected in the lobby.",
        );
        return;
      }

      if (this.clients.length !== this.maxClients) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_STATE,
          "Game mode selection requires two connected players.",
        );
        return;
      }

      if (client.sessionId !== this.state.hostSessionId) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.NOT_HOST,
          "Only the host can select the game mode.",
        );
        return;
      }

      if (!isSelectModeMessage(message)) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_PAYLOAD,
          "Invalid payload for select_mode.",
        );
        return;
      }

      if (!isValidMode(message.mode)) {
        this.sendActionError(client, ACTION_ERROR_CODES.INVALID_MODE, "Invalid game mode.");
        return;
      }

      this.state.gameMode = message.mode;
      this.startChoosingPhase();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.CHOICE, (client, message: unknown) => {
      if (this.state.gameStatus !== CHOOSING_GAME_STATUS) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_STATE,
          "Choices are only accepted during the choosing phase.",
        );
        return;
      }

      if (!isChoiceMessage(message)) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_PAYLOAD,
          "Invalid payload for choice.",
        );
        return;
      }

      if (!isValidChoice(message.choice)) {
        this.sendActionError(client, ACTION_ERROR_CODES.INVALID_CHOICE, "Invalid choice.");
        return;
      }

      const player = this.state.players.get(client.sessionId);
      if (!player) {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.INVALID_STATE,
          "Player is not part of this room.",
        );
        return;
      }

      if (player.choice !== "") {
        this.sendActionError(
          client,
          ACTION_ERROR_CODES.ALREADY_CHOSEN,
          "Choice already submitted for this round.",
        );
        return;
      }

      player.choice = message.choice;
      this.checkBothPlayersChosen();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_READY, (client) => {
      if (this.state.gameStatus !== FINISHED_GAME_STATUS) return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      markPlayerRematchReady(player);
      this.maybeResetToLobby();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_CANCEL, (client) => {
      if (this.state.gameStatus !== FINISHED_GAME_STATUS) return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      clearPlayerRematchReady(player);
    });
  }

  private startChoosingPhase(): void {
    this.state.gameStatus = CHOOSING_GAME_STATUS;
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
    if (this.state.gameStatus !== FINISHED_GAME_STATUS) return;
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
    this.state.gameStatus = this.state.players.size === 2 ? LOBBY_GAME_STATUS : WAITING_GAME_STATUS;
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
    this.state.gameStatus = RESULT_GAME_STATUS;
    this.scheduleResultTimeout();
  }

  private resumeChoosingCountdown(): void {
    if (this.state.gameStatus !== CHOOSING_GAME_STATUS) return;
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
        this.state.gameStatus = FINISHED_GAME_STATUS;
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
      this.state.gameStatus = FINISHED_GAME_STATUS;
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
    if (statusBeforeLeave === CHOOSING_GAME_STATUS) {
      this.stopCountdown();
    }

    if (canReconnect) {
      try {
        await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);

        if (this.state.gameStatus === CHOOSING_GAME_STATUS) {
          this.resumeChoosingCountdown();
        } else if (this.state.gameStatus === RESULT_GAME_STATUS) {
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
