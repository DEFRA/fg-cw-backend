import { describe, expect, it, vi } from "vitest";
import { findInboxPageUseCase } from "../use-cases/find-inbox-page.use-case.js";
import { findInboxRoute } from "./find-inbox.route.js";

vi.mock("../use-cases/find-inbox-page.use-case.js");

const STATUSES = [
  "PUBLISHED",
  "PROCESSING",
  "FAILED",
  "RESUBMITTED",
  "COMPLETED",
  "DEAD_LETTER",
];

const validateQuery = (query) =>
  findInboxRoute.options.validate.query.validate(query);

describe("findInboxRoute", () => {
  it("is a GET on /actuators/inbox", () => {
    expect(findInboxRoute.method).toBe("GET");
    expect(findInboxRoute.path).toBe("/actuators/inbox");
  });

  it("is on the public-api strategy", () => {
    expect(findInboxRoute.options.auth).toBe("public-api");
  });

  it("is tagged for the public API surface", () => {
    expect(findInboxRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("declares the service token security scheme", () => {
    expect(findInboxRoute.options.plugins["hapi-swagger"].security).toEqual([
      { serviceToken: [] },
    ]);
  });

  it("declares its own box's response schema", () => {
    expect(findInboxRoute.options.response.schema.describe().flags.label).toBe(
      "InboxPageResponse",
    );
  });

  it("declares the response schema without failing the request on drift", () => {
    expect(findInboxRoute.options.response.schema).toBeDefined();
    expect(findInboxRoute.options.response.failAction).toBe("log");
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
    findInboxPageUseCase.mockResolvedValue(page);

    const result = await findInboxRoute.handler({
      query: {
        cursor: "abc",
        direction: "backward",
        pageSize: 10,
        status: "DEAD_LETTER",
      },
    });

    expect(findInboxPageUseCase).toHaveBeenCalledWith({
      cursor: "abc",
      direction: "backward",
      pageSize: 10,
      status: "DEAD_LETTER",
    });
    expect(result).toBe(page);
  });
});
