import { type Client, Room } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 2;

  onCreate(options: unknown) {
    this.setState(new MyRoomState());

    this.onMessage("type", (client, message) => {});
  }

  onJoin(client: Client, options: unknown) {
    const player = new Player();
    player.sessionId = client.sessionId;
    this.state.players.set(client.sessionId, player);

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
