import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import config from "@colyseus/tools";
import { matchMaker } from "colyseus";
import type { RequestHandler } from "express";

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

export function resolveAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOriginList: readonly string[],
): string | undefined {
  if (allowedOriginList.length === 0) return undefined;
  if (typeof requestOrigin !== "string") return undefined;
  return allowedOriginList.includes(requestOrigin) ? requestOrigin : undefined;
}

export function isProductionMonitorEnabled(
  monitorUsername: string | undefined,
  monitorPassword: string | undefined,
): boolean {
  return Boolean(monitorUsername && monitorPassword);
}

function decodeBasicAuthorizationHeader(value: string | undefined): {
  username: string;
  password: string;
} | null {
  if (!value) {
    return null;
  }

  const parts = value.trim().split(/\s+/, 2);
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "basic") {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function createMonitorAuthMiddleware(username: string, password: string): RequestHandler {
  return (req, res, next) => {
    const credentials = decodeBasicAuthorizationHeader(req.headers.authorization);

    if (credentials?.username === username && credentials.password === password) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Colyseus Monitor"');
    res.status(401).send("Authentication required");
  };
}

if (allowedOrigins.length > 0) {
  matchMaker.controller.getCorsHeaders = (request) => {
    const originHeader = request.headers.origin;
    const requestOrigin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    const allowedOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
    const headers: Record<string, string> = {
      Vary: "Origin",
    };

    if (allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = allowedOrigin;
    }

    return headers;
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

    const isProduction = process.env.NODE_ENV === "production";
    const monitorUsername = process.env.MONITOR_USERNAME;
    const monitorPassword = process.env.MONITOR_PASSWORD;

    if (!isProduction) {
      app.use("/monitor", monitor());
      return;
    }

    if (isProductionMonitorEnabled(monitorUsername, monitorPassword)) {
      app.use("/monitor", createMonitorAuthMiddleware(monitorUsername, monitorPassword), monitor());
      return;
    }

    console.warn(
      "[monitor] disabled in production: set MONITOR_USERNAME and MONITOR_PASSWORD to enable.",
    );
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
