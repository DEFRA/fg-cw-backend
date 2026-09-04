import { describe, expect, it, vi } from "vitest";
import { unparkInboxEventUseCase } from "../use-cases/unpark-inbox-event.use-case.js";
import { unparkInboxEventRoute } from "./unpark-inbox-event.route.js";

vi.mock("../use-cases/unpark-inbox-event.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("unparkInboxEventRoute", () => {
  it("is a POST on the inbox unpark path", () => {
    expect(unparkInboxEventRoute.method).toBe("POST");
    expect(unparkInboxEventRoute.path).toBe("/actuators/inbox/{id}/unpark");
  });

  it("is behind the public-api auth strategy", () => {
    expect(unparkInboxEventRoute.options.auth).toBe("public-api");
  });

  it("takes no body - unparking says nothing new about the row", () => {
    expect(unparkInboxEventRoute.options.validate.payload).toBeUndefined();
  });

  it("passes the validated id to the use case", async () => {
    unparkInboxEventUseCase.mockResolvedValue({});

    await unparkInboxEventRoute.handler({ params: { id: ID }, query: {} });

    expect(unparkInboxEventUseCase).toHaveBeenCalledWith(ID);
  });
});
