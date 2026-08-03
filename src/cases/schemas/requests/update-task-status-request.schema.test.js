import { describe, expect, it } from "vitest";
import { updateTaskStatusRequestSchema } from "./update-task-status-request.schema.js";

describe("updateTaskStatusRequestSchema", () => {
  it("allows task values", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      value: "COMPLETE",
      completed: true,
    });
    expect(error).toBeUndefined();
  });

  it("does not allow invalid value", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      value: 999,
    });
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toContain('"value" must be a string');
  });

  it("requires value", () => {
    const { error } = updateTaskStatusRequestSchema.validate({});
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toContain('"value" is required');
  });

  it("allows comment", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      value: "COMPLETE",
      completed: true,
      comment: "This is a comment",
    });
    expect(error).toBeUndefined();
  });

  it("allows null comment", () => {
    const { error } = updateTaskStatusRequestSchema.validate({
      value: "COMPLETE",
      completed: true,
      comment: null,
    });
    expect(error).toBeUndefined();
  });

  it("removes other fields", () => {
    const { value, error } = updateTaskStatusRequestSchema.validate({
      value: "COMPLETE",
      completed: true,
      extraField: "should be removed",
    });
    expect(error).toBeUndefined();
    expect(value).toEqual({ value: "COMPLETE", completed: true });
  });
});
