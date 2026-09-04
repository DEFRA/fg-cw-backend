import { describe, expect, it, vi } from "vitest";
import { countInboxUseCase } from "../use-cases/count-inbox.use-case.js";
import { countInboxRoute } from "./count-inbox.route.js";

vi.mock("../use-cases/count-inbox.use-case.js");

const validateQuery = (query) =>
  countInboxRoute.options.validate.query.validate(query);

describe("countInboxRoute", () => {
  it("is a GET on /actuators/inbox/counts", () => {
    expect(countInboxRoute.method).toBe("GET");
    expect(countInboxRoute.path).toBe("/actuators/inbox/counts");
  });

  it("is on the public-api strategy", () => {
    expect(countInboxRoute.options.auth).toBe("public-api");
  });

  it("declares the counts response schema without failing on drift", () => {
    expect(countInboxRoute.options.response.schema.describe().flags.label).toBe(
      "BoxCountsResponse",
    );
    expect(countInboxRoute.options.response.failAction).toBe("log");
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
    countInboxUseCase.mockResolvedValue(answer);

    const result = await countInboxRoute.handler({
      query: {
        q: "GLD-9B2",
        error: "boom",
        from: "2026-06-16T00:00:00.000Z",
      },
    });

    expect(countInboxUseCase).toHaveBeenCalledWith({
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
