import { describe, expect, it } from "vitest";
import { timelineEventTypeSchema } from "./event-type.schema.js";

describe("eventType Schema", () => {
  it("allows valid eventTypes", () => {
    [
      "CASE_CREATED",
      "CASE_ASSIGNED",
      "CASE_UNASSIGNED",
      "TASK_COMPLETED",
      "STAGE_COMPLETED",
      "NOTE_ADDED",
    ].forEach((t) =>
      expect(timelineEventTypeSchema.validate(t).error).toBeUndefined(),
    );
  });

  it("does not allow others", () => {
    const { error } = timelineEventTypeSchema.validate("INVALID");
    expect(error.name).toEqual("ValidationError");
  });
});
