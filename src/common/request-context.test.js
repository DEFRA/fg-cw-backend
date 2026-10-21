import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";
import {
  getAuditIp,
  getRequestContext,
  normaliseIp,
  readClientIp,
  requestContext,
} from "./request-context.js";

vi.mock("./logger.js", () => ({
  logger: { warn: vi.fn() },
}));

const requestWith = (forwardedFor, remoteAddress = "127.0.0.1") => ({
  headers:
    forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
  info: { remoteAddress },
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requestContext", () => {
  const register = () => {
    let onRequestHandler;
    const server = {
      ext: (event, handler) => {
        if (event === "onRequest") {
          onRequestHandler = handler;
        }
      },
    };

    requestContext.plugin.register(server);

    return onRequestHandler;
  };

  const captureContext = async (request) => {
    let capturedContext;
    request._lifecycle = async () => {
      capturedContext = getRequestContext();
    };
    request._postCycle = async () => {};

    const h = { continue: Symbol("continue") };
    const result = register()(request, h);

    expect(result).toBe(h.continue);

    await request._lifecycle();

    return capturedContext;
  };

  it("returns null when no request context is active", () => {
    expect(getRequestContext()).toBeNull();
  });

  it("registers an onRequest extension that makes ip available for the rest of the request lifecycle", async () => {
    const context = await captureContext({
      info: { remoteAddress: "127.0.0.1" },
    });

    expect(context).toEqual({ ip: "127.0.0.1" });
    expect(getRequestContext()).toBeNull();
  });

  it("stores the client ip forwarded through the trusted local proxy", async () => {
    const context = await captureContext(requestWith("203.0.113.7"));

    expect(context).toEqual({ ip: "203.0.113.7" });
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

describe("normaliseIp", () => {
  it("leaves IPv4 unchanged", () => {
    expect(normaliseIp("203.0.113.7")).toBe("203.0.113.7");
  });

  it("turns an IPv4-mapped IPv6 address into plain IPv4", () => {
    expect(normaliseIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("compresses IPv6", () => {
    expect(normaliseIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(
      "2001:db8::1",
    );
  });

  it("drops an IPv6 zone id", () => {
    expect(normaliseIp("fe80::1%eth0")).toBe("fe80::1");
  });

  it("answers undefined for something that is not an IP", () => {
    expect(normaliseIp("not-an-ip")).toBeUndefined();
    expect(normaliseIp(undefined)).toBeUndefined();
  });
});

describe("getAuditIp", () => {
  it("answers the normalised client ip", () => {
    expect(getAuditIp(requestWith("2001:0db8::0001"), 1)).toBe("2001:db8::1");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to the connection address, with a warning, when the client IPv6 is longer than the audit schema allows", () => {
    expect(
      getAuditIp(
        requestWith("2001:db8:85a3:1234:5678:8a2e:370:7334", "198.51.100.4"),
        1,
      ),
    ).toBe("198.51.100.4");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("falls back to the connection address when the forwarded value is not an IP", () => {
    expect(getAuditIp(requestWith("not-an-ip", "198.51.100.4"), 1)).toBe(
      "198.51.100.4",
    );
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("answers undefined when neither address fits the audit schema", () => {
    expect(
      getAuditIp(
        requestWith(
          "2001:db8:85a3:1234:5678:8a2e:370:7334",
          "2001:db8:85a3:1234:5678:8a2e:370:7335",
        ),
        1,
      ),
    ).toBeUndefined();
  });
});
