import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRA_STRATEGY } from "../server/plugins/auth/entra.js";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  getRequestContext,
  readClientIp,
  requestContext,
} from "./request-context.js";

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

// Only `cdpEnvironment` is controlled here; everything else (e.g. the mongo
// uri pulled in via entra.js) keeps its real value.
vi.mock("./config.js", async (importOriginal) => {
  const { config } = await importOriginal();
  const realGet = config.get.bind(config);

  config.get = vi.fn((key) =>
    key === "cdpEnvironment" ? config.get.cdpEnvironment : realGet(key),
  );
  config.get.cdpEnvironment = "test";

  return { config };
});

const setCdpEnvironment = (value) => {
  config.get.cdpEnvironment = value;
};

const requestWith = (forwardedFor, remoteAddress = "127.0.0.1") => ({
  headers:
    forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
  info: { remoteAddress },
  path: "/cases",
});

afterEach(() => {
  vi.clearAllMocks();
  setCdpEnvironment("test");
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

  it("stores the trusted forwarded ip, untouched, for an Entra request and logs how it was chosen", async () => {
    const request = requestWith("6.6.6.6, ::ffff:203.0.113.7");

    const context = await captureContext(request, ENTRA_STRATEGY);

    expect(context).toEqual({
      remoteAddress: "127.0.0.1",
      clientIp: "::ffff:203.0.113.7",
    });
    expect(logger.debug).toHaveBeenCalledWith(
      {
        forwardedFor: "6.6.6.6, ::ffff:203.0.113.7",
        remoteAddress: "127.0.0.1",
        strategy: ENTRA_STRATEGY,
        clientIp: "::ffff:203.0.113.7",
      },
      "Chosen client IP from x-forwarded-for",
    );
  });

  it("ignores a forwarded header from a service-token caller", async () => {
    const context = await captureContext(
      requestWith("203.0.113.7"),
      PUBLIC_API_STRATEGY,
    );

    expect(context).toEqual({ remoteAddress: "127.0.0.1" });
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it("logs the raw forwarding facts in dev only", async () => {
    setCdpEnvironment("dev");

    await captureContext(requestWith("6.6.6.6, 203.0.113.7"));

    expect(config.get).toHaveBeenCalledWith("cdpEnvironment");
    expect(logger.info).toHaveBeenCalledWith(
      {
        xForwardedFor: "6.6.6.6, 203.0.113.7",
        remoteAddress: "127.0.0.1",
        path: "/cases",
      },
      "FGP-1520 client ip debug",
    );
  });

  it("does not log the raw forwarding facts outside dev", async () => {
    await captureContext(requestWith("6.6.6.6, 203.0.113.7"));

    expect(logger.info).not.toHaveBeenCalled();
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
