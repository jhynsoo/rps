import { type Client, type Delayed, Room } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

const VALID_MODES = ["single", "best_of_3", "best_of_5"];
const VALID_CHOICES = ["rock", "paper", "scissors"];

const WIN_MAP: Record<string, string> = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

export class MyRoom extends Room<MyRoomState> {
  maxClients = 2;
  private firstPlayerSessionId: string = "";
  private countdownInterval: Delayed | null = null;

  onCreate(_options: unknown) {
    this.setState(new MyRoomState());

    this.onMessage("select_mode", (client, message: { mode: string }) => {
      if (this.state.gameStatus !== "mode_select") return;
      if (client.sessionId !== this.firstPlayerSessionId) return;
      if (!VALID_MODES.includes(message.mode)) return;

      this.state.gameMode = message.mode;
      this.startChoosingPhase();
    });

    this.onMessage("choice", (client, message: { choice: string }) => {
      if (this.state.gameStatus !== "choosing") return;
      if (!VALID_CHOICES.includes(message.choice)) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || player.choice !== "") return;

      player.choice = message.choice;

      this.checkBothPlayersChosen();
    });
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

    this.clock.setTimeout(() => {
      this.handleRoundEnd();
    }, 3000);
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

  onJoin(client: Client, _options: unknown) {
    const player = new Player();
    player.sessionId = client.sessionId;
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.firstPlayerSessionId = client.sessionId;
    }

    if (this.state.players.size === 2) {
      this.state.gameStatus = "mode_select";
      this.lock();
    }
  }

  onLeave(client: Client, _consented: boolean) {
    const isGameInProgress =
      this.state.gameStatus !== "waiting" && this.state.gameStatus !== "finished";

    if (isGameInProgress && this.state.players.size === 2) {
      this.stopCountdown();

      const remainingPlayer = Array.from(this.state.players.values()).find(
        (p) => p.sessionId !== client.sessionId,
      );

      if (remainingPlayer) {
        this.state.winner = remainingPlayer.sessionId;
        this.state.gameStatus = "finished";
      }
    }

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    this.stopCountdown();
    console.log("room", this.roomId, "disposing...");
  }
}
