import { describe, expect, it, vi } from "vitest";
import { getOutboxEventStatusUseCase } from "../use-cases/get-outbox-event-status.use-case.js";
import { getOutboxEventStatusRoute } from "./get-outbox-event-status.route.js";

vi.mock("../use-cases/get-outbox-event-status.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const validateParams = (params) =>
  getOutboxEventStatusRoute.options.validate.params.validate(params);

describe("getOutboxEventStatusRoute", () => {
  it("is a GET on /actuators/events/outbox/{id}/status", () => {
    expect(getOutboxEventStatusRoute.method).toBe("GET");
    expect(getOutboxEventStatusRoute.path).toBe(
      "/actuators/events/outbox/{id}/status",
    );
  });

  it("is on the public-api strategy and surface", () => {
    expect(getOutboxEventStatusRoute.options.auth).toBe("public-api");
    expect(getOutboxEventStatusRoute.options.tags).toEqual([
      "api",
      "public-api",
    ]);
    expect(
      getOutboxEventStatusRoute.options.plugins["hapi-swagger"].security,
    ).toEqual([{ serviceToken: [] }]);
  });

  it("declares the status response, logging drift", () => {
    expect(
      getOutboxEventStatusRoute.options.response.schema.describe().flags.label,
    ).toBe("EventStatus");
    expect(getOutboxEventStatusRoute.options.response.failAction).toBe("log");
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: ID }).error).toBeUndefined();
    expect(validateParams({ id: "nope" }).error).toBeDefined();
  });

  it("passes the id to the use case and returns its answer", async () => {
    const status = {
      status: "RESUBMITTED",
      completionAttempts: 0,
      maxAttempts: 5,
    };
    getOutboxEventStatusUseCase.mockResolvedValue(status);

    expect(
      await getOutboxEventStatusRoute.handler({ params: { id: ID } }),
    ).toBe(status);
    expect(getOutboxEventStatusUseCase).toHaveBeenCalledWith({ id: ID });
  });
});
