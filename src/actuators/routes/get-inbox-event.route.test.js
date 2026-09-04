import { describe, expect, it, vi } from "vitest";
import { getInboxEventUseCase } from "../use-cases/get-inbox-event.use-case.js";
import { getInboxEventRoute } from "./get-inbox-event.route.js";

vi.mock("../use-cases/get-inbox-event.use-case.js");

const validateParams = (params) =>
  getInboxEventRoute.options.validate.params.validate(params);

describe("getInboxEventRoute", () => {
  it("is a GET on /actuators/inbox/{id}", () => {
    expect(getInboxEventRoute.method).toBe("GET");
    expect(getInboxEventRoute.path).toBe("/actuators/inbox/{id}");
  });

  it("is on the public-api strategy", () => {
    expect(getInboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(getInboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("declares the service token security scheme", () => {
    expect(getInboxEventRoute.options.plugins["hapi-swagger"].security).toEqual(
      [{ serviceToken: [] }],
    );
  });

  it("declares its own box's detail response schema", () => {
    expect(
      getInboxEventRoute.options.response.schema.describe().flags.label,
    ).toBe("InboxEventDetail");
  });

  it("logs response drift rather than failing the request", () => {
    expect(getInboxEventRoute.options.response.failAction).toBe("log");
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
    getInboxEventUseCase.mockResolvedValue(detail);

    const result = await getInboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
    });

    expect(getInboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
    );
    expect(result).toBe(detail);
  });
});
