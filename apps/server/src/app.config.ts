import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import config from "@colyseus/tools";
import { matchMaker } from "colyseus";

import {
  recordJoin,
  recordLeave,
  recordRoomCreated,
  recordRoomDisposed,
  snapshot,
} from "./observability/runtimeStats";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom";

function parseAllowedOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const allowedOrigins = parseAllowedOrigins(process.env.MATCHMAKER_ALLOWED_ORIGINS);

if (allowedOrigins.length > 0) {
  const allowedOriginSet = new Set(allowedOrigins);

  matchMaker.controller.getCorsHeaders = (request) => {
    const originHeader = request.headers.origin;
    const requestOrigin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    const allowedOrigin =
      typeof requestOrigin === "string" && allowedOriginSet.has(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0];

    return {
      "Access-Control-Allow-Origin": allowedOrigin,
      Vary: "Origin",
    };
  };
}

export default config({
  initializeGameServer: (gameServer) => {
    /**
     * Define your room handlers:
     */
    const myRoomHandler = gameServer.define("my_room", MyRoom);

    myRoomHandler.on("create", recordRoomCreated);
    myRoomHandler.on("dispose", recordRoomDisposed);
    myRoomHandler.on("join", recordJoin);
    myRoomHandler.on("leave", recordLeave);
  },

  initializeExpress: (app) => {
    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    app.get("/hello_world", (_req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
    });

    if (process.env.NODE_ENV !== "production") {
      app.get("/__debug/stats", (_req, res) => {
        res.json(snapshot({ includeMemory: true, includeHandleCount: true }));
      });
    }

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground());
    }

    /**
     * Use @colyseus/monitor
     * It is recommended to protect this route with a password
     * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
     */
    app.use("/monitor", monitor());
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
