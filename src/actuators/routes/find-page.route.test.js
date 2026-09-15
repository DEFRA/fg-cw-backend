import hapi from "@hapi/hapi";
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

  it("answers 400 to a query key the route does not declare", async () => {
    const server = hapi.server();
    server.auth.scheme("stub", () => ({
      authenticate: (_request, h) =>
        h.authenticated({ credentials: { service: "gas" } }),
    }));
    server.auth.strategy("public-api", "stub");
    server.route(findPageRoute);
    await server.initialize();

    const { statusCode } = await server.inject(
      "/actuators/events?someUnknownKey=x",
    );

    await server.stop();

    expect(statusCode).toBe(400);
    expect(findPageUseCase).not.toHaveBeenCalled();
  });

  it("defaults the page size and every section", () => {
    const { value } = validateQuery({});

    expect(value).toEqual({
      pageSize: 20,
      audit: "exclude",
      sections: ["list", "counts", "breakdown"],
    });
  });

  it.each([
    ["list", ["list"]],
    ["list,counts", ["list", "counts"]],
    ["breakdown,list,breakdown", ["breakdown", "list"]],
  ])("reads sections=%s as a list of sections", (sections, expected) => {
    const { error, value } = validateQuery({ sections });

    expect(error).toBeUndefined();
    expect(value.sections).toEqual(expected);
  });

  it.each(["", "rows", "list,", "list,nope", "list counts"])(
    "refuses sections=%j",
    (sections) => {
      expect(validateQuery({ sections }).error).toBeDefined();
    },
  );

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
      pageSize: 20,
      status: "DEAD_LETTER",
      sections: ["list"],
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    });

    expect(findPageUseCase).toHaveBeenCalledWith({
      inboxCursor: "IN",
      outboxCursor: "OUT",
      pageSize: 20,
      status: "DEAD_LETTER",
      sections: ["list"],
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    });
  });
});
