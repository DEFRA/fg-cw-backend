import { describe, expect, it } from "vitest";
import { timelineSchema } from "./timeline.schema.js";

describe("timeline schema", () => {
  const valid = {
    eventType: "CASE_CREATED",
    createdBy: { name: "Mickey Mouse" },
    createdAt: "2025-06-16T09:01:14.072Z",
    description: "Case created",
    data: {
      someOtherDetail: "any string",
    },
  };

  it("allows valid timeline data", () => {
    expect(timelineSchema.validate(valid).error).toBeUndefined();
  });

  it("allows optional data", () => {
    const { data, ...rest } = valid;
    expect(timelineSchema.validate(rest).error).toBeUndefined();
  });

  it("must have eventType", () => {
    const { eventType, ...rest } = valid;
    expect(timelineSchema.validate(rest).error.message).toBe(
      '"eventType" is required',
    );
    expect(
      timelineSchema.validate({ ...rest, eventType: "INVALID_VALUE" }).error
        .message,
    ).toBe(
      '"eventType" must be one of [CASE_CREATED, NOTE_ADDED, CASE_ASSIGNED, CASE_UNASSIGNED, SUBMISSION, TASK_COMPLETED, STAGE_COMPLETED]',
    );
  });

  it("must have createdBy as a TimelineUser", () => {
    const { createdBy, ...rest } = valid;
    expect(timelineSchema.validate(rest).error.message).toBe(
      '"TimelineUser" is required',
    );
    expect(
      timelineSchema.validate({ ...rest, createdBy: 9999 }).error.message,
    ).toBe('"TimelineUser" must be of type object');
  });

  it("must have createdAt as an iso date", () => {
    const { createdAt, ...rest } = valid;
    expect(timelineSchema.validate(rest).error.message).toBe(
      '"createdAt" is required',
    );
    expect(
      timelineSchema.validate({ ...rest, createdAt: "hello" }).error.message,
    ).toBe('"createdAt" must be in iso format');
  });

  it("must have description as a string", () => {
    const { description, ...rest } = valid;
    expect(timelineSchema.validate(rest).error.message).toBe(
      '"description" is required',
    );
    expect(
      timelineSchema.validate({ ...rest, description: 9999 }).error.message,
    ).toBe('"description" must be a string');
  });
});
