import { describe, expect, it, vi } from "vitest";
import { getInboxEventStatusUseCase } from "../use-cases/get-inbox-event-status.use-case.js";
import { getInboxEventStatusRoute } from "./get-inbox-event-status.route.js";

vi.mock("../use-cases/get-inbox-event-status.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const validateParams = (params) =>
  getInboxEventStatusRoute.options.validate.params.validate(params);

describe("getInboxEventStatusRoute", () => {
  it("is a GET on /actuators/events/inbox/{id}/status", () => {
    expect(getInboxEventStatusRoute.method).toBe("GET");
    expect(getInboxEventStatusRoute.path).toBe(
      "/actuators/events/inbox/{id}/status",
    );
  });

  it("is on the public-api strategy and surface", () => {
    expect(getInboxEventStatusRoute.options.auth).toBe("public-api");
    expect(getInboxEventStatusRoute.options.tags).toEqual([
      "api",
      "public-api",
    ]);
    expect(
      getInboxEventStatusRoute.options.plugins["hapi-swagger"].security,
    ).toEqual([{ serviceToken: [] }]);
  });

  it("declares the status response, logging drift", () => {
    expect(
      getInboxEventStatusRoute.options.response.schema.describe().flags.label,
    ).toBe("EventStatus");
    expect(getInboxEventStatusRoute.options.response.failAction).toBe("log");
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
    getInboxEventStatusUseCase.mockResolvedValue(status);

    expect(await getInboxEventStatusRoute.handler({ params: { id: ID } })).toBe(
      status,
    );
    expect(getInboxEventStatusUseCase).toHaveBeenCalledWith({ id: ID });
  });
});
