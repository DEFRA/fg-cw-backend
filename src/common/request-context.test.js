import { describe, expect, it } from "vitest";
import { getRequestContext, requestContext } from "./request-context.js";

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
});
