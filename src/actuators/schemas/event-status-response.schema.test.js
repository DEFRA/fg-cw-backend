import { describe, expect, it } from "vitest";
import { eventStatusResponseSchema } from "./event-status-response.schema.js";

describe("eventStatusResponseSchema", () => {
  it("accepts a status with its attempts against the cap", () => {
    expect(
      eventStatusResponseSchema.validate({
        status: "RESUBMITTED",
        completionAttempts: 0,
        maxAttempts: 5,
      }).error,
    ).toBeUndefined();
  });

  // A payload-free read: anything beyond the three keys is drift.
  it("rejects any other key", () => {
    expect(
      eventStatusResponseSchema.validate({
        status: "DEAD_LETTER",
        completionAttempts: 5,
        maxAttempts: 5,
        event: {},
      }).error,
    ).toBeDefined();
  });
});
