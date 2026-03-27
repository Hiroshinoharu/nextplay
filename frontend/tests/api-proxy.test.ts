import { afterEach, describe, expect, it } from "vitest";

import {
  buildUpstreamUrl,
  gatewayRequestTimeoutMs,
  normalizeGatewayBase,
} from "../api/proxy.js";

const ORIGINAL_TIMEOUT = process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS;

afterEach(() => {
  if (ORIGINAL_TIMEOUT === undefined) {
    delete process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS;
    return;
  }

  process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS = ORIGINAL_TIMEOUT;
});

describe("normalizeGatewayBase", () => {
  it("strips a trailing /api segment and preserves a base path", () => {
    const result = normalizeGatewayBase("https://gateway.example.com/edge/api/");

    expect(result.error).toBeUndefined();
    expect(result.url?.toString()).toBe("https://gateway.example.com/edge/");
  });

  it("rejects internal-only gateway hosts for Vercel proxying", () => {
    const result = normalizeGatewayBase("http://gateway:8084");

    expect(result.url).toBeUndefined();
    expect(result.error).toContain("publicly reachable gateway");
  });
});

describe("buildUpstreamUrl", () => {
  it("appends the request path under the configured gateway base path", () => {
    const gatewayBase = new URL("https://gateway.example.com/edge/");
    const upstreamUrl = buildUpstreamUrl(
      gatewayBase,
      "/api/users/csrf?refresh=true",
    );

    expect(upstreamUrl.toString()).toBe(
      "https://gateway.example.com/edge/api/users/csrf?refresh=true",
    );
  });
});

describe("gatewayRequestTimeoutMs", () => {
  it("uses the default timeout when the env var is unset or invalid", () => {
    delete process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS;
    expect(gatewayRequestTimeoutMs()).toBe(15_000);

    process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS = "abc";
    expect(gatewayRequestTimeoutMs()).toBe(15_000);
  });

  it("uses a positive integer override when configured", () => {
    process.env.NEXTPLAY_GATEWAY_TIMEOUT_MS = "7000";
    expect(gatewayRequestTimeoutMs()).toBe(7000);
  });
});
