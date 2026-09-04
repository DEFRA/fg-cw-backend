import { describe, expect, it, vi } from "vitest";
import { findOutboxPageUseCase } from "../use-cases/find-outbox-page.use-case.js";
import { findOutboxRoute } from "./find-outbox.route.js";

vi.mock("../use-cases/find-outbox-page.use-case.js");

const STATUSES = [
  "PUBLISHED",
  "PROCESSING",
  "FAILED",
  "RESUBMITTED",
  "COMPLETED",
  "DEAD_LETTER",
];

const validateQuery = (query) =>
  findOutboxRoute.options.validate.query.validate(query);

describe("findOutboxRoute", () => {
  it("is a GET on /actuators/outbox", () => {
    expect(findOutboxRoute.method).toBe("GET");
    expect(findOutboxRoute.path).toBe("/actuators/outbox");
  });

  it("is on the public-api strategy", () => {
    expect(findOutboxRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(findOutboxRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("declares the service token security scheme", () => {
    expect(findOutboxRoute.options.plugins["hapi-swagger"].security).toEqual([
      { serviceToken: [] },
    ]);
  });

  it("declares its own box's response schema", () => {
    expect(findOutboxRoute.options.response.schema.describe().flags.label).toBe(
      "OutboxPageResponse",
    );
  });

  it("declares the response schema without failing the request on drift", () => {
    expect(findOutboxRoute.options.response.schema).toBeDefined();
    expect(findOutboxRoute.options.response.failAction).toBe("log");
  });

  it("defaults direction to forward and pageSize to 20", () => {
    const { error, value } = validateQuery({});

    expect(error).toBeUndefined();
    expect(value).toEqual({ direction: "forward", pageSize: 20 });
  });

  it("accepts a request with no query at all", () => {
    expect(validateQuery({}).error).toBeUndefined();
  });

  it("rejects pageSize above 50", () => {
    expect(validateQuery({ pageSize: 51 }).error).toBeDefined();
  });

  it("rejects pageSize below 1", () => {
    expect(validateQuery({ pageSize: 0 }).error).toBeDefined();
  });

  it("rejects a fractional pageSize", () => {
    expect(validateQuery({ pageSize: 1.5 }).error).toBeDefined();
  });

  it("rejects an unknown direction", () => {
    expect(validateQuery({ direction: "sideways" }).error).toBeDefined();
  });

  it("rejects an unknown status", () => {
    expect(validateQuery({ status: "BOGUS" }).error).toBeDefined();
  });

  it("accepts each of the six statuses", () => {
    for (const status of STATUSES) {
      expect(validateQuery({ status }).error).toBeUndefined();
    }
  });

  it("rejects an unknown query parameter", () => {
    expect(validateQuery({ service: "gas" }).error).toBeDefined();
  });

  it("passes the validated query to the use case", async () => {
    const page = { data: [], pagination: {} };
    findOutboxPageUseCase.mockResolvedValue(page);

    const result = await findOutboxRoute.handler({
      query: {
        cursor: "abc",
        direction: "backward",
        pageSize: 10,
        status: "DEAD_LETTER",
      },
    });

    expect(findOutboxPageUseCase).toHaveBeenCalledWith({
      cursor: "abc",
      direction: "backward",
      pageSize: 10,
      status: "DEAD_LETTER",
    });
    expect(result).toBe(page);
  });
});

describe("findOutboxRoute q", () => {
  it("accepts a q and trims it", () => {
    const { error, value } = validateQuery({ q: "  GLD-9B2-BWS  " });

    expect(error).toBeUndefined();
    expect(value.q).toEqual("GLD-9B2-BWS");
  });

  it("treats an empty or whitespace-only q as absent", () => {
    expect(validateQuery({ q: "" }).value.q).toBeUndefined();
    expect(validateQuery({ q: "   " }).value.q).toBeUndefined();
    expect(validateQuery({ q: "" }).error).toBeUndefined();
  });

  it("accepts a q of exactly 200 characters", () => {
    expect(validateQuery({ q: "a".repeat(200) }).error).toBeUndefined();
  });

  it("rejects a q longer than 200 characters", () => {
    expect(validateQuery({ q: "a".repeat(201) }).error).toBeDefined();
  });

  // The TYPE filter is gone: `kind` is not a known parameter any more, so it
  // is rejected the way any unknown one is rather than quietly ignored.
  it("rejects kind, domain and audit alike, as an unknown parameter", () => {
    expect(validateQuery({ kind: "domain" }).error).toBeDefined();
    expect(validateQuery({ kind: "audit" }).error).toBeDefined();
    expect(validateQuery({ kind: "other" }).error).toBeDefined();
    expect(validateQuery({ kind: "" }).error).toBeDefined();
  });

  it("passes q to the use case, and no kind", async () => {
    findOutboxPageUseCase.mockResolvedValue({ data: [], pagination: {} });

    await findOutboxRoute.handler({
      query: { direction: "forward", pageSize: 20, q: "GLD-9B2" },
    });

    expect(findOutboxPageUseCase).toHaveBeenCalledWith({
      cursor: undefined,
      direction: "forward",
      pageSize: 20,
      status: undefined,
      q: "GLD-9B2",
    });
  });
});

describe("findOutboxRoute from and to", () => {
  it("accepts an ISO from and to", () => {
    const { error, value } = validateQuery({
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });

    expect(error).toBeUndefined();
    expect(value.from).toBe("2026-06-16T00:00:00.000Z");
    expect(value.to).toBe("2026-06-16T23:59:59.999Z");
  });

  it("rejects a non-ISO bound and from after to", () => {
    expect(validateQuery({ from: "yesterday" }).error).toBeDefined();
    expect(
      validateQuery({
        from: "2026-06-16T10:00:00.000Z",
        to: "2026-06-15T10:00:00.000Z",
      }).error,
    ).toBeDefined();
  });

  it("passes from and to to the use case", async () => {
    findOutboxPageUseCase.mockResolvedValue({ data: [], pagination: {} });

    await findOutboxRoute.handler({
      query: {
        direction: "forward",
        pageSize: 20,
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-16T23:59:59.999Z",
      },
    });

    expect(findOutboxPageUseCase).toHaveBeenCalledWith({
      cursor: undefined,
      direction: "forward",
      pageSize: 20,
      status: undefined,
      q: undefined,
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });
  });
});
