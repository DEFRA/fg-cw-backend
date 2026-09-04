import { describe, expect, it, vi } from "vitest";
import { redriveInboxEventUseCase } from "../use-cases/redrive-inbox-event.use-case.js";
import { redriveInboxEventRoute } from "./redrive-inbox-event.route.js";

vi.mock("../use-cases/redrive-inbox-event.use-case.js");

const validateParams = (params) =>
  redriveInboxEventRoute.options.validate.params.validate(params);

describe("redriveInboxEventRoute", () => {
  it("is a POST on /actuators/inbox/{id}/redrive", () => {
    expect(redriveInboxEventRoute.method).toBe("POST");
    expect(redriveInboxEventRoute.path).toBe("/actuators/inbox/{id}/redrive");
  });

  it("is on the public-api strategy", () => {
    expect(redriveInboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(redriveInboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("answers with one list row, not a detail document", () => {
    expect(
      redriveInboxEventRoute.options.response.schema.describe().flags.label,
    ).toBe("InboxEvent");
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: "../../etc" }).error).toBeDefined();
  });

  it("passes the validated id to the use case", async () => {
    const row = { _id: "665f1c2e9a1b2c3d4e5f6a7b", status: "RESUBMITTED" };
    redriveInboxEventUseCase.mockResolvedValue(row);

    const result = await redriveInboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
      query: {},
    });

    expect(redriveInboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
      { by: null },
    );
    expect(result).toBe(row);
  });
});

describe("redriveInboxEventRoute actor", () => {
  it("passes the `by` query parameter through to the use case", async () => {
    redriveInboxEventUseCase.mockResolvedValue({});

    await redriveInboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
      query: { by: "donatas" },
    });

    expect(redriveInboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
      { by: "donatas" },
    );
  });

  it("validates `by` against the shared actor query schema", () => {
    expect(redriveInboxEventRoute.options.validate.query).toBeDefined();
  });
});
