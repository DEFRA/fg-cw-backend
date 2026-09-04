import { describe, expect, it, vi } from "vitest";
import { countOutboxUseCase } from "../use-cases/count-outbox.use-case.js";
import { countOutboxRoute } from "./count-outbox.route.js";

vi.mock("../use-cases/count-outbox.use-case.js");

const validateQuery = (query) =>
  countOutboxRoute.options.validate.query.validate(query);

describe("countOutboxRoute", () => {
  it("is a GET on /actuators/outbox/counts", () => {
    expect(countOutboxRoute.method).toBe("GET");
    expect(countOutboxRoute.path).toBe("/actuators/outbox/counts");
  });

  it("is on the public-api strategy", () => {
    expect(countOutboxRoute.options.auth).toBe("public-api");
  });

  it("declares the counts response schema without failing on drift", () => {
    expect(
      countOutboxRoute.options.response.schema.describe().flags.label,
    ).toBe("BoxCountsResponse");
    expect(countOutboxRoute.options.response.failAction).toBe("log");
  });

  it("accepts an empty query", () => {
    expect(validateQuery({}).error).toBeUndefined();
  });

  it("rejects a status - the endpoint counts per status", () => {
    expect(validateQuery({ status: "FAILED" }).error).toBeDefined();
  });

  it("rejects a cursor", () => {
    expect(validateQuery({ cursor: "abc" }).error).toBeDefined();
  });

  it("rejects from after to", () => {
    expect(
      validateQuery({
        from: "2026-06-16T10:00:00.000Z",
        to: "2026-06-15T10:00:00.000Z",
      }).error,
    ).toBeDefined();
  });

  it("passes the validated query to the use case", async () => {
    const answer = { counts: {} };
    countOutboxUseCase.mockResolvedValue(answer);

    const result = await countOutboxRoute.handler({
      query: {
        q: "GLD-9B2",
        error: "boom",
        from: "2026-06-16T00:00:00.000Z",
      },
    });

    expect(countOutboxUseCase).toHaveBeenCalledWith({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: undefined,
    });
    expect(result).toBe(answer);
  });

  // The counts endpoint used to drop `error` on the floor while the list and
  // the breakdown honoured it, so a filtered count disagreed with the page it
  // described. The faceted numbers make that visible, so it is threaded now.
  it("forwards the error filter, which the query has always accepted", () => {
    expect(validateQuery({ error: "boom" }).error).toBeUndefined();
  });
});
