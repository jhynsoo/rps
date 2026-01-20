import { type Client, Room } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

const VALID_MODES = ["single", "best_of_3", "best_of_5"];

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
