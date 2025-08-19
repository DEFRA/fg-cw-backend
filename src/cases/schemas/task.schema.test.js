import { describe, expect, it } from "vitest";
import { Task } from "./task.schema.js";

describe("Task Schema", () => {
  it("should not allow invalid hasNote", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "yes",
    };

    const { error } = Task.validate(task);

    expect(error.details[0].message).toBe(
      '"hasNote" must be one of [required, optional, none]',
    );
  });

  it("should pass validation with a noteRef when hasNote is 'required'", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "required",
      noteRef: "1234-0987-hjyg-8765-6542",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should not require a noteRef if hasNote is 'none'", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "none",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should not require a noteRef if hasNote is 'optional'", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "optional",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should pass validation with a noteRef if hasNote is 'optional'", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "optional",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should allow 'none' as hasNote", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
      hasNote: "none",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should allow undefined hasNote", () => {
    const task = {
      id: "abcd-0987-hjyg-8765-6542",
      title: "Test task",
      type: "boolean",
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });
});
