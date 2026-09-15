import { describe, expect, it, vi } from "vitest";
import { redriveOutboxEventUseCase } from "../use-cases/redrive-outbox-event.use-case.js";
import { redriveOutboxEventRoute } from "./redrive-outbox-event.route.js";

vi.mock("../use-cases/redrive-outbox-event.use-case.js");

const validateParams = (params) =>
  redriveOutboxEventRoute.options.validate.params.validate(params);

describe("redriveOutboxEventRoute", () => {
  it("is a POST on /actuators/events/outbox/{id}/redrive", () => {
    expect(redriveOutboxEventRoute.method).toBe("POST");
    expect(redriveOutboxEventRoute.path).toBe("/actuators/events/outbox/{id}/redrive");
  });

  it("is on the public-api strategy", () => {
    expect(redriveOutboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(redriveOutboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: "../../etc" }).error).toBeDefined();
  });

  it("passes the validated id to the use case and answers 204 with no body", async () => {
    redriveOutboxEventUseCase.mockResolvedValue(undefined);
    const code = vi.fn().mockReturnValue("no-content");
    const h = { response: vi.fn().mockReturnValue({ code }) };

    const result = await redriveOutboxEventRoute.handler(
      {
        params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
        query: {},
        auth: { credentials: { service: "fg-gas-backend" } },
      },
      h,
    );

    expect(redriveOutboxEventUseCase).toHaveBeenCalledWith({
      id: "665f1c2e9a1b2c3d4e5f6a7b",
      by: null,
      caller: "fg-gas-backend",
    });
    expect(h.response).toHaveBeenCalledWith();
    expect(code).toHaveBeenCalledWith(204);
    expect(result).toBe("no-content");
  });
});

describe("redriveOutboxEventRoute actor", () => {
  it("passes the `by` query parameter through to the use case", async () => {
    redriveOutboxEventUseCase.mockResolvedValue(undefined);
    const h = { response: () => ({ code: () => null }) };

    await redriveOutboxEventRoute.handler(
      {
        params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
        query: { by: "donatas" },
        auth: { credentials: { service: "fg-gas-backend" } },
      },
      h,
    );

    expect(redriveOutboxEventUseCase).toHaveBeenCalledWith({
      id: "665f1c2e9a1b2c3d4e5f6a7b",
      by: "donatas",
      caller: "fg-gas-backend",
    });
  });

  it("validates `by` against the shared actor query schema", () => {
    expect(redriveOutboxEventRoute.options.validate.query).toBeDefined();
  });

  it("records no caller when the request carries no service credentials", async () => {
    redriveOutboxEventUseCase.mockResolvedValue(undefined);
    const h = { response: () => ({ code: () => null }) };

    await redriveOutboxEventRoute.handler(
      { params: { id: "665f1c2e9a1b2c3d4e5f6a7b" }, query: {}, auth: {} },
      h,
    );

    expect(redriveOutboxEventUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ caller: null }),
    );
  });
});
