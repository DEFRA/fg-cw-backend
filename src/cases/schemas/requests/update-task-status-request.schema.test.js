import { describe, expect, it } from "vitest";
import { updateTaskStatusRequestSchema } from "./update-task-status-request.schema.js";

describe("updateTaskStatusRequestSchema", () => {
  it("allows task statuses", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      status: "complete",
    });
    expect(error).toBeUndefined();
  });

  it("does not allow invalid status", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      status: 999,
    });
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toContain('"status" must be a string');
  });

  it("requires status", () => {
    const { error } = updateTaskStatusRequestSchema.validate({});
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toContain('"status" is required');
  });

  it("allows comment", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      status: "complete",
      comment: "This is a comment",
    });
    expect(error).toBeUndefined();
  });

  it("allows null comment", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      status: "complete",
      comment: null,
    });
    expect(error).toBeUndefined();
  });

  it("removes other fields", () => {
    const { value, error } = updateTaskStatusRequestSchema.validate({
      status: "complete",
      extraField: "should be removed",
    });
    expect(error).toBeUndefined();
    expect(value).toEqual({ status: "complete" });
  });
});
