import { describe, expect, it } from "vitest";
import { ENTRA_STRATEGY } from "../server/plugins/auth/entra.js";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import {
  getRequestContext,
  readClientIp,
  requestContext,
} from "./request-context.js";

const requestWith = (forwardedFor, remoteAddress = "127.0.0.1") => ({
  headers:
    forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
  info: { remoteAddress },
});

describe("requestContext", () => {
  const register = () => {
    const handlers = {};
    const server = {
      ext: (event, handler) => {
        handlers[event] = handler;
      },
    };

    requestContext.plugin.register(server);

    return handlers;
  };

  const continueSymbol = Symbol("continue");

  const captureContext = async (request, strategy) => {
    const handlers = register();
    let capturedContext;
    request._lifecycle = async () => {
      if (strategy) {
        request.auth = { strategy };
        handlers.onPostAuth(request, { continue: continueSymbol });
      }
      capturedContext = getRequestContext();
    };
    request._postCycle = async () => {};

    const h = { continue: continueSymbol };
    const result = handlers.onRequest(request, h);

    expect(result).toBe(h.continue);

    await request._lifecycle();

    return capturedContext;
  };

  it("returns null when no request context is active", () => {
    expect(getRequestContext()).toBeNull();
  });

  it("registers an onRequest extension that makes the connection address available for the rest of the request lifecycle", async () => {
    const context = await captureContext({
      info: { remoteAddress: "127.0.0.1" },
    });

    expect(context).toEqual({ remoteAddress: "127.0.0.1" });
    expect(getRequestContext()).toBeNull();
  });

  it("stores no client ip when a forwarded header arrives before auth", async () => {
    const context = await captureContext(requestWith("203.0.113.7"));

    expect(context).toEqual({ remoteAddress: "127.0.0.1" });
  });

  it("stores the trusted forwarded ip, untouched, for an Entra request", async () => {
    const request = requestWith("6.6.6.6, ::ffff:203.0.113.7");

    const context = await captureContext(request, ENTRA_STRATEGY);

    expect(context).toEqual({
      remoteAddress: "127.0.0.1",
      clientIp: "::ffff:203.0.113.7",
    });
  });

  it("ignores a forwarded header from a service-token caller", async () => {
    const context = await captureContext(
      requestWith("203.0.113.7"),
      PUBLIC_API_STRATEGY,
    );

    expect(context).toEqual({ remoteAddress: "127.0.0.1" });
  });
});

describe("readClientIp", () => {
  it("answers the connection address when nothing was forwarded", () => {
    expect(readClientIp(requestWith(undefined, "198.51.100.4"), 1)).toBe(
      "198.51.100.4",
    );
  });

  it("answers the entry the trusted proxy appended", () => {
    expect(readClientIp(requestWith("203.0.113.7"), 1)).toBe("203.0.113.7");
  });

  it("ignores entries a caller sent ahead of the trusted proxy", () => {
    expect(readClientIp(requestWith("6.6.6.6, 203.0.113.7"), 1)).toBe(
      "203.0.113.7",
    );
  });

  it("counts back one entry per trusted proxy", () => {
    expect(readClientIp(requestWith("6.6.6.6, 203.0.113.7, 10.0.0.2"), 2)).toBe(
      "203.0.113.7",
    );
  });

  it("answers the furthest entry when the chain is shorter than the trusted proxy count", () => {
    expect(readClientIp(requestWith("203.0.113.7"), 3)).toBe("203.0.113.7");
  });

  it("trusts nothing forwarded when no proxies are trusted", () => {
    expect(readClientIp(requestWith("203.0.113.7", "198.51.100.4"), 0)).toBe(
      "198.51.100.4",
    );
  });

  it("skips blank entries", () => {
    expect(readClientIp(requestWith(" , 203.0.113.7 , "), 1)).toBe(
      "203.0.113.7",
    );
  });
});
