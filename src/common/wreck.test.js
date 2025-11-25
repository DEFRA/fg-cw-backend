import { getTraceId } from "@defra/hapi-tracing";
import { describe, expect, it, vi } from "vitest";
import { config } from "./config.js";
import { wreck } from "./wreck.js";

vi.mock("@defra/hapi-tracing");

describe("wreck", () => {
  const tracingHeader = config.get("tracing.header");

  it("adds a trace id header when in async scope", () => {
    getTraceId.mockReturnValue("test-trace-id");

    const options = {};

    wreck.events.emit("preRequest", "http://localhost", options);

    expect(options.headers?.[tracingHeader]).toEqual("test-trace-id");
  });

  it("does not add a trace id header when not in async scope", () => {
    getTraceId.mockReturnValue(undefined);

    const options = {};

    wreck.events.emit("preRequest", "http://localhost", options);

    expect(options.headers?.[tracingHeader]).toBeUndefined();
  });
});
