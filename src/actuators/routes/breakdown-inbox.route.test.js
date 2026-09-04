import { describe, expect, it, vi } from "vitest";
import { breakdownInboxUseCase } from "../use-cases/breakdown-inbox.use-case.js";
import { breakdownInboxRoute } from "./breakdown-inbox.route.js";

vi.mock("../use-cases/breakdown-inbox.use-case.js");

describe("breakdownInboxRoute", () => {
  it("is a GET on the inbox breakdown path", () => {
    expect(breakdownInboxRoute.method).toBe("GET");
    expect(breakdownInboxRoute.path).toBe("/actuators/inbox/breakdown");
  });

  it("is behind the public-api auth strategy", () => {
    expect(breakdownInboxRoute.options.auth).toBe("public-api");
  });

  it("rejects a status parameter - the scope is always DEAD_LETTER", () => {
    const { error } = breakdownInboxRoute.options.validate.query.validate({
      status: "FAILED",
    });

    expect(error).toBeDefined();
  });

  it("passes the selection filter through to the use case", async () => {
    breakdownInboxUseCase.mockResolvedValue({ groups: [] });

    await breakdownInboxRoute.handler({
      query: {
        q: "GLD-9B2",
        error: "boom",
        from: "a",
        to: "b",
      },
    });

    expect(breakdownInboxUseCase).toHaveBeenCalledWith({
      q: "GLD-9B2",
      error: "boom",
      from: "a",
      to: "b",
    });
  });
});
