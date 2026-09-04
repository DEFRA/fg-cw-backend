import { describe, expect, it, vi } from "vitest";
import { unparkOutboxEventUseCase } from "../use-cases/unpark-outbox-event.use-case.js";
import { unparkOutboxEventRoute } from "./unpark-outbox-event.route.js";

vi.mock("../use-cases/unpark-outbox-event.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("unparkOutboxEventRoute", () => {
  it("is a POST on the outbox unpark path", () => {
    expect(unparkOutboxEventRoute.method).toBe("POST");
    expect(unparkOutboxEventRoute.path).toBe("/actuators/outbox/{id}/unpark");
  });

  it("is behind the public-api auth strategy", () => {
    expect(unparkOutboxEventRoute.options.auth).toBe("public-api");
  });

  it("takes no body - unparking says nothing new about the row", () => {
    expect(unparkOutboxEventRoute.options.validate.payload).toBeUndefined();
  });

  it("passes the validated id to the use case", async () => {
    unparkOutboxEventUseCase.mockResolvedValue({});

    await unparkOutboxEventRoute.handler({ params: { id: ID }, query: {} });

    expect(unparkOutboxEventUseCase).toHaveBeenCalledWith(ID);
  });
});
