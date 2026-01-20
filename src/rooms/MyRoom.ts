import { type Client, Room } from "colyseus";
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

  onCreate(options: unknown) {
    this.setState(new MyRoomState());

    this.onMessage("select_mode", (client, message: { mode: string }) => {
      if (this.state.gameStatus !== "mode_select") return;
      if (client.sessionId !== this.firstPlayerSessionId) return;
      if (!VALID_MODES.includes(message.mode)) return;

      this.state.gameMode = message.mode;
      this.state.gameStatus = "choosing";
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

  private checkBothPlayersChosen() {
    let allChosen = true;
    this.state.players.forEach((player) => {
      if (player.choice === "") allChosen = false;
    });

    if (allChosen && this.state.players.size === 2) {
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
  }

  onJoin(client: Client, options: unknown) {
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

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
