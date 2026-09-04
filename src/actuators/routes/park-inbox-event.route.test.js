import { describe, expect, it, vi } from "vitest";
import { parkInboxEventUseCase } from "../use-cases/park-inbox-event.use-case.js";
import { parkInboxEventRoute } from "./park-inbox-event.route.js";

vi.mock("../use-cases/park-inbox-event.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("parkInboxEventRoute", () => {
  it("is a POST on the inbox park path", () => {
    expect(parkInboxEventRoute.method).toBe("POST");
    expect(parkInboxEventRoute.path).toBe("/actuators/inbox/{id}/park");
  });

  it("is behind the public-api auth strategy", () => {
    expect(parkInboxEventRoute.options.auth).toBe("public-api");
  });

  it("validates the id, the actor query and the body", () => {
    const { params, query, payload } = parkInboxEventRoute.options.validate;

    expect(params).toBeDefined();
    expect(query).toBeDefined();
    expect(payload).toBeDefined();
  });

  it("requires a reason", () => {
    const { error } = parkInboxEventRoute.options.validate.payload.validate({});

    expect(error).toBeDefined();
  });

  it("rejects a reason over 512 characters", () => {
    const { error } = parkInboxEventRoute.options.validate.payload.validate({
      reason: "x".repeat(513),
    });

    expect(error).toBeDefined();
  });

  it("passes the id, the reason and the actor to the use case", async () => {
    parkInboxEventUseCase.mockResolvedValue({});

    await parkInboxEventRoute.handler({
      params: { id: ID },
      query: { by: "donatas" },
      payload: { reason: "poison" },
    });

    expect(parkInboxEventUseCase).toHaveBeenCalledWith(ID, {
      reason: "poison",
      by: "donatas",
    });
  });

  it("passes a null actor when nobody named themselves", async () => {
    parkInboxEventUseCase.mockResolvedValue({});

    await parkInboxEventRoute.handler({
      params: { id: ID },
      query: {},
      payload: { reason: "poison" },
    });

    expect(parkInboxEventUseCase).toHaveBeenCalledWith(ID, {
      reason: "poison",
      by: null,
    });
  });
});
