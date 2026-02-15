import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") nickname: string = "Player";
  @type("string") choice: string = "";
  @type("number") score: number = 0;
  @type("boolean") isReady: boolean = false;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") hostSessionId: string = "";
  @type("string") gameStatus: string = "waiting";
  @type("string") gameMode: string = "";
  @type("number") countdown: number = 0;
  @type("string") winner: string = "";
  @type("number") roundNumber: number = 1;
}
