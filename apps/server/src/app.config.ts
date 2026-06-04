import { timingSafeEqual } from "node:crypto";

import { matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import config from "@colyseus/tools";
import { WebSocketTransport } from "@colyseus/ws-transport";
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

export function resolveRequiredAllowedOrigins(
  nodeEnv: string | undefined,
  rawValue: string | undefined,
): string[] {
  const origins = parseAllowedOrigins(rawValue);

  if (nodeEnv === "production" && origins.length === 0) {
    throw new Error(
      "MATCHMAKER_ALLOWED_ORIGINS must be set in production to the public web origin allowlist.",
    );
  }

  return origins;
}

const allowedOrigins = resolveRequiredAllowedOrigins(
  process.env.NODE_ENV,
  process.env.MATCHMAKER_ALLOWED_ORIGINS,
);

function resolveHeaderOrigin(headers: Headers): string | undefined {
  return headers.get("origin") ?? undefined;
}

export function resolveAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOriginList: readonly string[],
): string | undefined {
  if (allowedOriginList.length === 0) return undefined;
  if (typeof requestOrigin !== "string") return undefined;
  return allowedOriginList.includes(requestOrigin) ? requestOrigin : undefined;
}

export function createMatchmakerCorsHeaders(
  headers: Headers,
  allowedOriginList: readonly string[],
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(resolveHeaderOrigin(headers), allowedOriginList);

  return {
    Vary: "Origin",
    "Access-Control-Allow-Credentials": allowedOrigin ? "true" : "false",
    "Access-Control-Allow-Origin": allowedOrigin ?? "null",
  };
}

export function assertAllowedMatchmakerOrigin(
  headers: Headers,
  allowedOriginList: readonly string[],
): void {
  const requestOrigin = resolveHeaderOrigin(headers);
  if (!requestOrigin) return;
  if (resolveAllowedOrigin(requestOrigin, allowedOriginList)) return;

  const error = new Error("Origin not allowed") as Error & { code?: number };
  error.code = 403;
  throw error;
}

type WebSocketVerifyInfo = {
  origin: string;
};

type WebSocketVerifyCallback = (allowed: boolean, code?: number, message?: string) => void;

export function createWebSocketVerifyClient(allowedOriginList: readonly string[]) {
  return (info: WebSocketVerifyInfo, done: WebSocketVerifyCallback): void => {
    if (!info.origin || resolveAllowedOrigin(info.origin, allowedOriginList)) {
      done(true);
      return;
    }

    done(false, 403, "Origin not allowed");
  };
}

export function isProductionMonitorEnabled(
  monitorUsername: string | undefined,
  monitorPassword: string | undefined,
): boolean {
  return Boolean(
    typeof monitorUsername === "string" &&
      monitorUsername.length > 0 &&
      typeof monitorPassword === "string" &&
      monitorPassword.length > 0,
  );
}

function resolveMonitorCredentials(
  monitorUsername: string | undefined,
  monitorPassword: string | undefined,
): { username: string; password: string } | null {
  if (!monitorUsername || !monitorPassword) {
    return null;
  }

  return {
    username: monitorUsername,
    password: monitorPassword,
  };
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

function isConstantTimeMatch(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function createMonitorAuthMiddleware(username: string, password: string): RequestHandler {
  return (req, res, next) => {
    const credentials = decodeBasicAuthorizationHeader(req.headers.authorization);

    if (
      credentials &&
      isConstantTimeMatch(credentials.username, username) &&
      isConstantTimeMatch(credentials.password, password)
    ) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Colyseus Monitor"');
    res.status(401).send("Authentication required");
  };
}

function createAllowedOriginMiddleware(allowedOriginList: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const originHeader = req.headers.origin;
    const requestOrigin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    if (!requestOrigin) {
      next();
      return;
    }

    const allowedOrigin = resolveAllowedOrigin(requestOrigin, allowedOriginList);
    res.setHeader("Vary", "Origin");

    if (!allowedOrigin) {
      res.removeHeader("Access-Control-Allow-Origin");
      res.removeHeader("Access-Control-Allow-Credentials");
      res.status(403).send("Origin not allowed");
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  };
}

function installMatchmakerOriginPolicy(allowedOriginList: readonly string[]): void {
  if (allowedOriginList.length === 0) return;

  matchMaker.controller.getCorsHeaders = (headers) => {
    return createMatchmakerCorsHeaders(headers, allowedOriginList);
  };

  const invokeMethod = matchMaker.controller.invokeMethod.bind(matchMaker.controller);
  matchMaker.controller.invokeMethod = (method, roomName, clientOptions, authOptions) => {
    if (authOptions?.headers) {
      assertAllowedMatchmakerOrigin(authOptions.headers, allowedOriginList);
    }

    return invokeMethod(method, roomName, clientOptions, authOptions);
  };
}

installMatchmakerOriginPolicy(allowedOrigins);

export default config({
  initializeTransport: (transportOptions) =>
    new WebSocketTransport({
      ...transportOptions,
      verifyClient:
        allowedOrigins.length > 0 ? createWebSocketVerifyClient(allowedOrigins) : undefined,
    }),

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

  initializeExpress: async (app) => {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      app.use(createAllowedOriginMiddleware(allowedOrigins));
    }

    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    if (!isProduction) {
      app.get("/hello_world", (_req, res) => {
        res.send("It's time to kick ass and chew bubblegum!");
      });
    }

    if (!isProduction) {
      app.get("/__debug/stats", (_req, res) => {
        res.json(snapshot({ includeMemory: true, includeHandleCount: true }));
      });
    }

    const monitorCredentials = resolveMonitorCredentials(
      process.env.MONITOR_USERNAME,
      process.env.MONITOR_PASSWORD,
    );

    if (!isProduction) {
      app.use("/monitor", monitor());
      return;
    }

    if (monitorCredentials) {
      app.use(
        "/monitor",
        createMonitorAuthMiddleware(monitorCredentials.username, monitorCredentials.password),
        monitor(),
      );
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
