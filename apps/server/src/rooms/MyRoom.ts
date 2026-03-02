import { type Client, type Delayed, Room } from "colyseus";
import {
  CLIENT_MESSAGE_TYPES,
  GAME_MODES,
  RECONNECT_GRACE_SECONDS,
  RPS_CHOICES,
} from "@rps/contracts";
import { MyRoomState, Player } from "./schema/MyRoomState";

const VALID_MODES = GAME_MODES as readonly string[];
const VALID_CHOICES = RPS_CHOICES as readonly string[];

const WIN_MAP: Record<string, string> = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSelectModeMessage(value: unknown): value is { mode: string } {
  if (!isRecord(value)) return false;
  return typeof value.mode === "string";
}

function isChoiceMessage(value: unknown): value is { choice: string } {
  if (!isRecord(value)) return false;
  return typeof value.choice === "string";
}

export class MyRoom extends Room<MyRoomState> {
  maxClients = 2;
  private countdownInterval: Delayed | null = null;
  private resultTimeout: Delayed | null = null;

  onCreate(_options: unknown) {
    this.setState(new MyRoomState());

    this.onMessage(CLIENT_MESSAGE_TYPES.SELECT_MODE, (client, message: unknown) => {
      if (this.state.gameStatus !== "mode_select") return;
      if (client.sessionId !== this.state.hostSessionId) return;
      if (!isSelectModeMessage(message)) return;
      if (!VALID_MODES.includes(message.mode)) return;

      this.state.gameMode = message.mode;
      this.startChoosingPhase();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.CHOICE, (client, message: unknown) => {
      if (this.state.gameStatus !== "choosing") return;
      if (!isChoiceMessage(message)) return;
      if (!VALID_CHOICES.includes(message.choice)) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.choice !== "") return;

      player.choice = message.choice;

      this.checkBothPlayersChosen();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_READY, (client) => {
      if (this.state.gameStatus !== "finished") return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.isReady = true;
      this.maybeResetToLobby();
    });

    this.onMessage(CLIENT_MESSAGE_TYPES.REMATCH_CANCEL, (client) => {
      if (this.state.gameStatus !== "finished") return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.isReady = false;
    });
  }

  private sanitizeNickname(value: unknown): string {
    if (typeof value !== "string") return "Player";
    const trimmed = value.trim();
    if (trimmed.length === 0) return "Player";
    return trimmed.slice(0, 12);
  }

  private startChoosingPhase() {
    this.state.gameStatus = "choosing";
    this.state.countdown = 10;

    this.countdownInterval = this.clock.setInterval(() => {
      this.state.countdown -= 1;

      if (this.state.countdown <= 0) {
        this.stopCountdown();
        this.assignRandomChoices();
        this.determineWinner();
      }
    }, 1000);
  }

  private stopCountdown() {
    if (this.countdownInterval) {
      this.countdownInterval.clear();
      this.countdownInterval = null;
    }
  }

  private syncRoomLock() {
    if (this.state.players.size >= this.maxClients) {
      this.lock();
      return;
    }

    this.unlock();
  }

  private maybeResetToLobby() {
    if (this.state.gameStatus !== "finished") return;
    if (this.state.players.size !== 2) return;

    let allReady = true;
    this.state.players.forEach((player) => {
      if (!player.isReady) allReady = false;
    });

    if (!allReady) return;

    this.resetMatchState();
  }

  private resetMatchState() {
    this.stopResultTimeout();
    this.stopCountdown();

    this.state.players.forEach((player) => {
      player.score = 0;
      player.choice = "";
      player.isReady = false;
    });

    this.state.roundNumber = 1;
    this.state.winner = "";
    this.state.countdown = 0;
    this.state.gameMode = "";
    this.state.gameStatus = this.state.players.size === 2 ? "mode_select" : "waiting";
    this.syncRoomLock();
  }

  private assignRandomChoices() {
    this.state.players.forEach((player) => {
      if (player.choice === "") {
        const randomIndex = Math.floor(Math.random() * VALID_CHOICES.length);
        player.choice = VALID_CHOICES[randomIndex];
      }
    });
  }

  private checkBothPlayersChosen() {
    let allChosen = true;
    this.state.players.forEach((player) => {
      if (player.choice === "") allChosen = false;
    });

    if (allChosen && this.state.players.size === 2) {
      this.stopCountdown();
      this.determineWinner();
    }
  }

  private determineWinner() {
    const players = Array.from(this.state.players.values());
    if (players.length < 2) return;

    const p1 = players[0];
    const p2 = players[1];

    if (p1.choice === p2.choice) {
      this.state.winner = "draw";
    } else if (WIN_MAP[p1.choice] === p2.choice) {
      this.state.winner = p1.sessionId;
      p1.score += 1;
    } else {
      this.state.winner = p2.sessionId;
      p2.score += 1;
    }

    this.state.gameStatus = "result";
    this.scheduleResultTimeout();
  }

  private stopResultTimeout() {
    if (this.resultTimeout) {
      this.resultTimeout.clear();
      this.resultTimeout = null;
    }
  }

  private scheduleResultTimeout(delayMs = 3000) {
    this.stopResultTimeout();
    this.resultTimeout = this.clock.setTimeout(() => {
      this.resultTimeout = null;
      this.handleRoundEnd();
    }, delayMs);
  }

  private resumeChoosingCountdown() {
    if (this.state.gameStatus !== "choosing") return;
    if (this.countdownInterval) return;
    if (this.state.players.size !== 2) return;

    if (this.state.countdown <= 0) {
      this.assignRandomChoices();
      this.determineWinner();
      return;
    }

    this.countdownInterval = this.clock.setInterval(() => {
      this.state.countdown -= 1;

      if (this.state.countdown <= 0) {
        this.stopCountdown();
        this.assignRandomChoices();
        this.determineWinner();
      }
    }, 1000);
  }

  private shouldAllowGracefulReconnection(consented: boolean): boolean {
    if (consented) return false;
    if (this.state.players.size !== 2) return false;

    return (
      this.state.gameStatus === "mode_select" ||
      this.state.gameStatus === "choosing" ||
      this.state.gameStatus === "result"
    );
  }

  private finalizePlayerLeave(sessionId: string) {
    const isGameInProgress =
      this.state.gameStatus !== "waiting" && this.state.gameStatus !== "finished";

    if (isGameInProgress && this.state.players.size === 2) {
      this.stopCountdown();

      const remainingPlayer = Array.from(this.state.players.values()).find((p) => p.sessionId !== sessionId);

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
      const nextHost = this.state.players.values().next().value as Player | undefined;
      this.state.hostSessionId = nextHost?.sessionId ?? "";
    }

    this.syncRoomLock();
  }

  private getWinThreshold(): number {
    switch (this.state.gameMode) {
      case "single":
        return 1;
      case "best_of_3":
        return 2;
      case "best_of_5":
        return 3;
      default:
        return 1;
    }
  }

  private handleRoundEnd() {
    const winThreshold = this.getWinThreshold();
    const players = Array.from(this.state.players.values());
    const gameWinner = players.find((p) => p.score >= winThreshold);

    if (gameWinner) {
      this.state.gameStatus = "finished";
      this.state.winner = gameWinner.sessionId;
    } else {
      players.forEach((player) => {
        player.choice = "";
      });
      this.state.roundNumber += 1;
      this.state.winner = "";
      this.startChoosingPhase();
    }
  }

  onJoin(client: Client, options: unknown) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.nickname = this.sanitizeNickname((options as Record<string, unknown> | null)?.nickname);
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.state.hostSessionId = client.sessionId;
    } else if (this.state.hostSessionId === "") {
      const firstPlayer = this.state.players.values().next().value as Player | undefined;
      this.state.hostSessionId = firstPlayer?.sessionId ?? "";
    }

    if (this.state.players.size === this.maxClients) {
      this.resetMatchState();
      return;
    }

    this.syncRoomLock();
  }

  async onLeave(client: Client, consented: boolean) {
    const canReconnect = this.shouldAllowGracefulReconnection(consented);
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

  onDispose() {
    this.stopResultTimeout();
    this.stopCountdown();
    console.log("room", this.roomId, "disposing...");
  }
}
