import { describe, expect, it } from "vitest";
import {
  getClientIp,
  getRequestContext,
  requestContext,
} from "./request-context.js";

describe("requestContext", () => {
  it("returns null when no request context is active", () => {
    expect(getRequestContext()).toBeNull();
  });

  it("registers an onRequest extension that makes ip available for the rest of the request lifecycle", async () => {
    let onRequestHandler;
    const server = {
      ext: (event, handler) => {
        if (event === "onRequest") {
          onRequestHandler = handler;
        }
      },
    };

    requestContext.plugin.register(server);

    let capturedContext;
    const request = {
      info: { remoteAddress: "127.0.0.1" },
      _lifecycle: async () => {
        capturedContext = getRequestContext();
      },
      _postCycle: async () => {},
    };

    const h = { continue: Symbol("continue") };
    const result = onRequestHandler(request, h);

    expect(result).toBe(h.continue);

    await request._lifecycle();

    expect(capturedContext).toEqual({ ip: "127.0.0.1" });
    expect(getRequestContext()).toBeNull();
  });

  it("stores the originating client ip from x-forwarded-for rather than the local proxy", async () => {
    let onRequestHandler;
    requestContext.plugin.register({
      ext: (_event, handler) => {
        onRequestHandler = handler;
      },
    });

    let capturedContext;
    const request = {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.2" },
      info: { remoteAddress: "127.0.0.1" },
      _lifecycle: async () => {
        capturedContext = getRequestContext();
      },
      _postCycle: async () => {},
    };

    onRequestHandler(request, { continue: Symbol("continue") });
    await request._lifecycle();

    expect(capturedContext).toEqual({ ip: "203.0.113.7" });
  });
});

describe("getClientIp", () => {
  const requestWith = (forwardedFor, remoteAddress = "127.0.0.1") => ({
    headers:
      forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
    info: { remoteAddress },
  });

  it("uses the first x-forwarded-for entry", () => {
    expect(getClientIp(requestWith(" 203.0.113.7 , 10.0.0.2"))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to remoteAddress when x-forwarded-for is absent", () => {
    expect(getClientIp(requestWith(undefined, "198.51.100.4"))).toBe(
      "198.51.100.4",
    );
  });

  it("falls back to remoteAddress when x-forwarded-for is empty", () => {
    expect(getClientIp(requestWith("", "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("strips the IPv4-mapped IPv6 prefix", () => {
    expect(getClientIp(requestWith("::ffff:203.0.113.7"))).toBe("203.0.113.7");
  });

  it("falls back to remoteAddress when the forwarded ip exceeds the audit schema's 20 characters", () => {
    expect(
      getClientIp(
        requestWith("2001:0db8:85a3:0000:0000:8a2e:0370:7334", "198.51.100.4"),
      ),
    ).toBe("198.51.100.4");
  });

  it("answers undefined when no candidate fits the audit schema", () => {
    expect(
      getClientIp(
        requestWith(
          "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
          "2001:0db8:85a3:0000:0000:8a2e:0370:7335",
        ),
      ),
    ).toBeUndefined();
  });
});
