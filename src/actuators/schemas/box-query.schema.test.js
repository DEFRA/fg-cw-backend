import { describe, expect, it } from "vitest";
import {
  actorQuery,
  boxBreakdownQuery,
  boxCountsQuery,
  boxListQuery,
} from "./box-query.schema.js";

const FROM = "2026-06-16T00:00:00.000Z";
const TO = "2026-06-16T23:59:59.999Z";

describe("boxListQuery", () => {
  it("defaults direction and pageSize and accepts an empty query", () => {
    const { error, value } = boxListQuery.validate({});

    expect(error).toBeUndefined();
    expect(value).toEqual({ direction: "forward", pageSize: 20 });
  });

  it("accepts each of the six statuses", () => {
    for (const status of [
      "PUBLISHED",
      "PROCESSING",
      "FAILED",
      "RESUBMITTED",
      "COMPLETED",
      "DEAD_LETTER",
    ]) {
      expect(boxListQuery.validate({ status }).error).toBeUndefined();
    }
  });

  it("accepts from and to as ISO dates", () => {
    const { error, value } = boxListQuery.validate({ from: FROM, to: TO });

    expect(error).toBeUndefined();
    expect(value.from).toBe(FROM);
    expect(value.to).toBe(TO);
  });

  it("keeps from and to as strings rather than parsing them into Dates", () => {
    expect(typeof boxListQuery.validate({ from: FROM }).value.from).toBe(
      "string",
    );
  });

  it("accepts either bound on its own", () => {
    expect(boxListQuery.validate({ from: FROM }).error).toBeUndefined();
    expect(boxListQuery.validate({ to: TO }).error).toBeUndefined();
  });

  it("rejects a bound that is not an ISO date", () => {
    expect(boxListQuery.validate({ from: "yesterday" }).error).toBeDefined();
    expect(boxListQuery.validate({ to: "16/06/2026" }).error).toBeDefined();
  });

  it("rejects from after to", () => {
    const { error } = boxListQuery.validate({ from: TO, to: FROM });

    expect(error.message).toBe('"from" must be earlier than or equal to "to"');
  });

  it("accepts from equal to to", () => {
    expect(
      boxListQuery.validate({ from: FROM, to: FROM }).error,
    ).toBeUndefined();
  });

  it("compares the bounds as instants, not as strings", () => {
    expect(
      boxListQuery.validate({
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-16T01:00:00.000+02:00",
      }).error,
    ).toBeDefined();
  });

  it("rejects an unknown query parameter", () => {
    expect(boxListQuery.validate({ service: "gas" }).error).toBeDefined();
  });
});

describe("boxCountsQuery", () => {
  it("accepts an empty query", () => {
    const { error, value } = boxCountsQuery.validate({});

    expect(error).toBeUndefined();
    expect(value).toEqual({});
  });

  it("accepts the same selection the list takes", () => {
    const { error, value } = boxCountsQuery.validate({
      q: "  GLD-9B2  ",
      from: FROM,
      to: TO,
    });

    expect(error).toBeUndefined();
    expect(value).toEqual({ q: "GLD-9B2", from: FROM, to: TO });
  });

  // The TYPE filter is gone: `kind` is rejected as any unknown parameter is.
  it("rejects kind as an unknown parameter", () => {
    expect(boxCountsQuery.validate({ kind: "audit" }).error).toBeDefined();
    expect(boxListQuery.validate({ kind: "domain" }).error).toBeDefined();
    expect(boxBreakdownQuery.validate({ kind: "audit" }).error).toBeDefined();
  });

  it("does NOT accept a status - counting per status is the point", () => {
    expect(boxCountsQuery.validate({ status: "FAILED" }).error).toBeDefined();
  });

  it("does not accept cursor, direction or pageSize", () => {
    expect(boxCountsQuery.validate({ cursor: "abc" }).error).toBeDefined();
    expect(
      boxCountsQuery.validate({ direction: "forward" }).error,
    ).toBeDefined();
    expect(boxCountsQuery.validate({ pageSize: 20 }).error).toBeDefined();
  });

  it("applies the same range rule as the list", () => {
    expect(boxCountsQuery.validate({ from: TO, to: FROM }).error.message).toBe(
      '"from" must be earlier than or equal to "to"',
    );
  });

  it("treats a whitespace-only q as absent", () => {
    expect(boxCountsQuery.validate({ q: "   " }).value.q).toBeUndefined();
  });
});

describe("box query error filter", () => {
  it("accepts an exact error message on the list query", () => {
    expect(
      boxListQuery.validate({ error: "No handler found" }).error,
    ).toBeUndefined();
  });

  it("accepts one on the counts query too, so the two cannot drift", () => {
    expect(
      boxCountsQuery.validate({ error: "No handler found" }).error,
    ).toBeUndefined();
  });

  it("trims, and treats whitespace-only as absent rather than as a 400", () => {
    expect(boxListQuery.validate({ error: "  boom  " }).value.error).toBe(
      "boom",
    );
    expect(boxListQuery.validate({ error: "" }).value.error).toBeUndefined();
  });

  it("caps the message at 512 characters", () => {
    expect(
      boxListQuery.validate({ error: "x".repeat(512) }).error,
    ).toBeUndefined();
    expect(
      boxListQuery.validate({ error: "x".repeat(513) }).error,
    ).toBeDefined();
  });
});

describe("boxBreakdownQuery", () => {
  it("takes the counts selection", () => {
    expect(
      boxBreakdownQuery.validate({
        q: "GLD-9B2",
        error: "boom",
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-16T23:59:59.999Z",
      }).error,
    ).toBeUndefined();
  });

  it("rejects a status - the breakdown is always over DEAD_LETTER rows", () => {
    expect(
      boxBreakdownQuery.validate({ status: "FAILED" }).error,
    ).toBeDefined();
  });

  it("rejects a reversed range, exactly as the list does", () => {
    expect(
      boxBreakdownQuery.validate({
        from: "2026-06-17T00:00:00.000Z",
        to: "2026-06-16T00:00:00.000Z",
      }).error.message,
    ).toContain('"from" must be earlier than or equal to "to"');
  });
});

describe("actorQuery", () => {
  it("accepts an operator name", () => {
    expect(actorQuery.validate({ by: "donatas" }).error).toBeUndefined();
  });

  it("is optional - an unattributed mutation is still a mutation", () => {
    expect(actorQuery.validate({}).error).toBeUndefined();
  });

  it("caps the actor at 128 characters", () => {
    expect(actorQuery.validate({ by: "x".repeat(128) }).error).toBeUndefined();
    expect(actorQuery.validate({ by: "x".repeat(129) }).error).toBeDefined();
  });
});
