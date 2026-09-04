import { describe, expect, it, vi } from "vitest";
import { getOutboxEventUseCase } from "../use-cases/get-outbox-event.use-case.js";
import { getOutboxEventRoute } from "./get-outbox-event.route.js";

vi.mock("../use-cases/get-outbox-event.use-case.js");

const validateParams = (params) =>
  getOutboxEventRoute.options.validate.params.validate(params);

describe("getOutboxEventRoute", () => {
  it("is a GET on /actuators/outbox/{id}", () => {
    expect(getOutboxEventRoute.method).toBe("GET");
    expect(getOutboxEventRoute.path).toBe("/actuators/outbox/{id}");
  });

  it("is on the public-api strategy", () => {
    expect(getOutboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(getOutboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("declares the service token security scheme", () => {
    expect(
      getOutboxEventRoute.options.plugins["hapi-swagger"].security,
    ).toEqual([{ serviceToken: [] }]);
  });

  it("declares its own box's detail response schema", () => {
    expect(
      getOutboxEventRoute.options.response.schema.describe().flags.label,
    ).toBe("OutboxEventDetail");
  });

  it("logs response drift rather than failing the request", () => {
    expect(getOutboxEventRoute.options.response.failAction).toBe("log");
  });

  it("accepts a 24-hex id", () => {
    expect(
      validateParams({ id: "665f1c2e9a1b2c3d4e5f6a7b" }).error,
    ).toBeUndefined();
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: "nope" }).error).toBeDefined();
  });

  it("passes the validated id to the use case", async () => {
    const detail = { _id: "665f1c2e9a1b2c3d4e5f6a7b" };
    getOutboxEventUseCase.mockResolvedValue(detail);

    const result = await getOutboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
    });

    expect(getOutboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
    );
    expect(result).toBe(detail);
  });
});
