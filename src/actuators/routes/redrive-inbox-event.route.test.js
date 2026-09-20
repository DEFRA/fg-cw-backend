import { describe, expect, it, vi } from "vitest";
import { redriveInboxEventUseCase } from "../use-cases/redrive-inbox-event.use-case.js";
import { redriveInboxEventRoute } from "./redrive-inbox-event.route.js";

vi.mock("../use-cases/redrive-inbox-event.use-case.js");

const validateParams = (params) =>
  redriveInboxEventRoute.options.validate.params.validate(params);

describe("redriveInboxEventRoute", () => {
  it("is a POST on /actuators/events/inbox/{id}/redrive", () => {
    expect(redriveInboxEventRoute.method).toBe("POST");
    expect(redriveInboxEventRoute.path).toBe("/actuators/events/inbox/{id}/redrive");
  });

  it("is on the public-api strategy", () => {
    expect(redriveInboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(redriveInboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: "../../etc" }).error).toBeDefined();
  });

  it("passes the validated id to the use case and answers 204 with no body", async () => {
    redriveInboxEventUseCase.mockResolvedValue(undefined);
    const code = vi.fn().mockReturnValue("no-content");
    const h = { response: vi.fn().mockReturnValue({ code }) };

    const result = await redriveInboxEventRoute.handler(
      {
        params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
        query: {},
        auth: { credentials: { service: "fg-gas-backend" } },
      },
      h,
    );

    expect(redriveInboxEventUseCase).toHaveBeenCalledWith({
      id: "665f1c2e9a1b2c3d4e5f6a7b",
      by: null,
      caller: "fg-gas-backend",
    });
    expect(h.response).toHaveBeenCalledWith();
    expect(code).toHaveBeenCalledWith(204);
    expect(result).toBe("no-content");
  });
});

describe("redriveInboxEventRoute actor", () => {
  it("passes the `by` query parameter through to the use case", async () => {
    redriveInboxEventUseCase.mockResolvedValue(undefined);
    const h = { response: () => ({ code: () => null }) };

    await redriveInboxEventRoute.handler(
      {
        params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
        query: { by: "donatas" },
        auth: { credentials: { service: "fg-gas-backend" } },
      },
      h,
    );

    expect(redriveInboxEventUseCase).toHaveBeenCalledWith({
      id: "665f1c2e9a1b2c3d4e5f6a7b",
      by: "donatas",
      caller: "fg-gas-backend",
    });
  });

  it("validates `by` against the shared actor query schema", () => {
    expect(redriveInboxEventRoute.options.validate.query).toBeDefined();
  });

  it("records no caller when the request carries no service credentials", async () => {
    redriveInboxEventUseCase.mockResolvedValue(undefined);
    const h = { response: () => ({ code: () => null }) };

    await redriveInboxEventRoute.handler(
      { params: { id: "665f1c2e9a1b2c3d4e5f6a7b" }, query: {}, auth: {} },
      h,
    );

    expect(redriveInboxEventUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ caller: null }),
    );
  });
});
