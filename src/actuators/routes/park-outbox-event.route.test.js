import { describe, expect, it, vi } from "vitest";
import { parkOutboxEventUseCase } from "../use-cases/park-outbox-event.use-case.js";
import { parkOutboxEventRoute } from "./park-outbox-event.route.js";

vi.mock("../use-cases/park-outbox-event.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("parkOutboxEventRoute", () => {
  it("is a POST on the outbox park path", () => {
    expect(parkOutboxEventRoute.method).toBe("POST");
    expect(parkOutboxEventRoute.path).toBe("/actuators/outbox/{id}/park");
  });

  it("is behind the public-api auth strategy", () => {
    expect(parkOutboxEventRoute.options.auth).toBe("public-api");
  });

  it("validates the id, the actor query and the body", () => {
    const { params, query, payload } = parkOutboxEventRoute.options.validate;

    expect(params).toBeDefined();
    expect(query).toBeDefined();
    expect(payload).toBeDefined();
  });

  it("requires a reason", () => {
    const { error } = parkOutboxEventRoute.options.validate.payload.validate(
      {},
    );

    expect(error).toBeDefined();
  });

  it("rejects a reason over 512 characters", () => {
    const { error } = parkOutboxEventRoute.options.validate.payload.validate({
      reason: "x".repeat(513),
    });

    expect(error).toBeDefined();
  });

  it("passes the id, the reason and the actor to the use case", async () => {
    parkOutboxEventUseCase.mockResolvedValue({});

    await parkOutboxEventRoute.handler({
      params: { id: ID },
      query: { by: "donatas" },
      payload: { reason: "poison" },
    });

    expect(parkOutboxEventUseCase).toHaveBeenCalledWith(ID, {
      reason: "poison",
      by: "donatas",
    });
  });

  it("passes a null actor when nobody named themselves", async () => {
    parkOutboxEventUseCase.mockResolvedValue({});

    await parkOutboxEventRoute.handler({
      params: { id: ID },
      query: {},
      payload: { reason: "poison" },
    });

    expect(parkOutboxEventUseCase).toHaveBeenCalledWith(ID, {
      reason: "poison",
      by: null,
    });
  });
});
