import { describe, expect, it, vi } from "vitest";
import { findPageUseCase } from "../use-cases/find-page.use-case.js";
import { findPageRoute } from "./find-page.route.js";

vi.mock("../use-cases/find-page.use-case.js");

const validateQuery = (query) =>
  findPageRoute.options.validate.query.validate(query);

const handle = (query) => findPageRoute.handler({ query });

describe("findPageRoute", () => {
  it("is a GET on /actuators/events", () => {
    expect(findPageRoute.method).toBe("GET");
    expect(findPageRoute.path).toBe("/actuators/events");
  });

  it("is on the public-api strategy", () => {
    expect(findPageRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(findPageRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("declares the service token security scheme", () => {
    expect(findPageRoute.options.plugins["hapi-swagger"].security).toEqual([
      { serviceToken: [] },
    ]);
  });

  it("declares the composite response schema", () => {
    expect(findPageRoute.options.response.schema.describe().flags.label).toBe(
      "ActuatorPageResponse",
    );
  });

  // A response that drifted is logged and still answered: a page half of whose
  // sections are readable is worth more to an operator than a 500.
  it("declares the response schema without failing the request on drift", () => {
    expect(findPageRoute.options.response.failAction).toBe("log");
  });

  it("takes a cursor for each box", () => {
    const { error, value } = validateQuery({
      inboxCursor: "IN",
      outboxCursor: "OUT",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ inboxCursor: "IN", outboxCursor: "OUT" });
  });

  it("has no single shared cursor to mistake for one of them", () => {
    expect(validateQuery({ cursor: "IN" }).error).toBeDefined();
  });

  it("defaults the direction and the page size, as the box lists do", () => {
    const { value } = validateQuery({});

    expect(value).toMatchObject({ direction: "forward", pageSize: 20 });
  });

  it.each([
    ["q", { q: "GLD-9B2" }],
    ["error", { error: "boom" }],
    ["from", { from: "2026-06-16T00:00:00.000Z" }],
    ["to", { to: "2026-06-16T23:59:59.000Z" }],
    ["audit", { audit: "include" }],
    ["status", { status: "DEAD_LETTER" }],
  ])("takes the shared %s filter", (_name, query) => {
    expect(validateQuery(query).error).toBeUndefined();
  });

  it("refuses a status outside the six", () => {
    expect(validateQuery({ status: "PARKED" }).error).toBeDefined();
  });

  it("refuses a range that ends before it starts", () => {
    const { error } = validateQuery({
      from: "2026-06-17T00:00:00.000Z",
      to: "2026-06-16T00:00:00.000Z",
    });

    expect(error.message).toContain("must be earlier than or equal to");
  });

  it("hands the whole query to the use case", async () => {
    findPageUseCase.mockResolvedValue({});

    await handle({
      inboxCursor: "IN",
      outboxCursor: "OUT",
      direction: "forward",
      pageSize: 20,
      status: "DEAD_LETTER",
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    });

    expect(findPageUseCase).toHaveBeenCalledWith({
      inboxCursor: "IN",
      outboxCursor: "OUT",
      direction: "forward",
      pageSize: 20,
      status: "DEAD_LETTER",
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    });
  });
});
