import { describe, expect, it, vi } from "vitest";
import { breakdownOutboxUseCase } from "../use-cases/breakdown-outbox.use-case.js";
import { breakdownOutboxRoute } from "./breakdown-outbox.route.js";

vi.mock("../use-cases/breakdown-outbox.use-case.js");

describe("breakdownOutboxRoute", () => {
  it("is a GET on the outbox breakdown path", () => {
    expect(breakdownOutboxRoute.method).toBe("GET");
    expect(breakdownOutboxRoute.path).toBe("/actuators/outbox/breakdown");
  });

  it("is behind the public-api auth strategy", () => {
    expect(breakdownOutboxRoute.options.auth).toBe("public-api");
  });

  it("rejects a status parameter - the scope is always DEAD_LETTER", () => {
    const { error } = breakdownOutboxRoute.options.validate.query.validate({
      status: "FAILED",
    });

    expect(error).toBeDefined();
  });

  it("passes the selection filter through to the use case", async () => {
    breakdownOutboxUseCase.mockResolvedValue({ groups: [] });

    await breakdownOutboxRoute.handler({
      query: {
        q: "GLD-9B2",
        error: "boom",
        from: "a",
        to: "b",
      },
    });

    expect(breakdownOutboxUseCase).toHaveBeenCalledWith({
      q: "GLD-9B2",
      error: "boom",
      from: "a",
      to: "b",
    });
  });
});
