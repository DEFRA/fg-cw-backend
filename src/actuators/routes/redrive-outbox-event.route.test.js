import { describe, expect, it, vi } from "vitest";
import { redriveOutboxEventUseCase } from "../use-cases/redrive-outbox-event.use-case.js";
import { redriveOutboxEventRoute } from "./redrive-outbox-event.route.js";

vi.mock("../use-cases/redrive-outbox-event.use-case.js");

const validateParams = (params) =>
  redriveOutboxEventRoute.options.validate.params.validate(params);

describe("redriveOutboxEventRoute", () => {
  it("is a POST on /actuators/outbox/{id}/redrive", () => {
    expect(redriveOutboxEventRoute.method).toBe("POST");
    expect(redriveOutboxEventRoute.path).toBe("/actuators/outbox/{id}/redrive");
  });

  it("is on the public-api strategy", () => {
    expect(redriveOutboxEventRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(redriveOutboxEventRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("answers with one list row, not a detail document", () => {
    expect(
      redriveOutboxEventRoute.options.response.schema.describe().flags.label,
    ).toBe("OutboxEvent");
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(validateParams({ id: "../../etc" }).error).toBeDefined();
  });

  it("passes the validated id to the use case", async () => {
    const row = { _id: "665f1c2e9a1b2c3d4e5f6a7b", status: "RESUBMITTED" };
    redriveOutboxEventUseCase.mockResolvedValue(row);

    const result = await redriveOutboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
      query: {},
    });

    expect(redriveOutboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
      { by: null },
    );
    expect(result).toBe(row);
  });
});

describe("redriveOutboxEventRoute actor", () => {
  it("passes the `by` query parameter through to the use case", async () => {
    redriveOutboxEventUseCase.mockResolvedValue({});

    await redriveOutboxEventRoute.handler({
      params: { id: "665f1c2e9a1b2c3d4e5f6a7b" },
      query: { by: "donatas" },
    });

    expect(redriveOutboxEventUseCase).toHaveBeenCalledWith(
      "665f1c2e9a1b2c3d4e5f6a7b",
      { by: "donatas" },
    );
  });

  it("validates `by` against the shared actor query schema", () => {
    expect(redriveOutboxEventRoute.options.validate.query).toBeDefined();
  });
});
