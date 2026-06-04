import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function addColyseusOriginPair(sources: Set<string>, rawUrl: string): void {
  try {
    const url = new URL(rawUrl);
    const host = url.host;

    if (url.protocol === "ws:") {
      sources.add(`ws://${host}`);
      sources.add(`http://${host}`);
      return;
    }

    if (url.protocol === "wss:") {
      sources.add(`wss://${host}`);
      sources.add(`https://${host}`);
      return;
    }

    if (url.protocol === "http:") {
      sources.add(`http://${host}`);
      sources.add(`ws://${host}`);
      return;
    }

    if (url.protocol === "https:") {
      sources.add(`https://${host}`);
      sources.add(`wss://${host}`);
    }
  } catch {
    // Ignore malformed env values here; the client/server startup paths surface them.
  }
}

function resolveConnectSrc(): string {
  const sources = new Set(["'self'"]);
  const configuredEndpoint = process.env.NEXT_PUBLIC_COLYSEUS_URL;

  if (configuredEndpoint) {
    addColyseusOriginPair(sources, configuredEndpoint);
  } else {
    addColyseusOriginPair(sources, "ws://127.0.0.1:2567");
    addColyseusOriginPair(sources, "ws://localhost:2567");
  }

  return Array.from(sources).join(" ");
}

function shouldUpgradeInsecureRequests(): boolean {
  const configuredEndpoint = process.env.NEXT_PUBLIC_COLYSEUS_URL;
  if (!configuredEndpoint) return false;

  try {
    const url = new URL(configuredEndpoint);
    return url.protocol === "https:" || url.protocol === "wss:";
  } catch {
    return false;
  }
}

function resolveContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${resolveConnectSrc()}`,
  ];

  if (shouldUpgradeInsecureRequests()) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: resolveContentSecurityPolicy(),
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
