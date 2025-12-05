import { describe, expect, it } from "vitest";
import { Task } from "./task.schema.js";

describe("Task Schema", () => {
  it("should allow missing optional comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      statusOptions: [],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    };

    const { error } = Task.validate(task);

    expect(error).toBeUndefined();
  });

  it("should have label if comment is provided", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      statusOptions: [],
      comment: {
        helpText: "Please provide a note",
        mandatory: false,
      },
    };

    const { error } = Task.validate(task);

    expect(error.details[0].message).toBe('"comment.label" is required');
  });

  it("should have helpText if comment is provided", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      statusOptions: [],
      comment: {
        label: "Note",
        mandatory: false,
      },
    };

    const { error } = Task.validate(task);

    expect(error.details[0].message).toBe('"comment.helpText" is required');
  });

  it("should error when comment.mandatory is not present", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      statusOptions: [],
      comment: {
        label: "Note",
        helpText: "Please provide a note",
      },
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe('"comment.mandatory" is required');
  });

  it("should allow null comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      statusOptions: [
        {
          code: "COMPLETE",
          name: "Complete",
          theme: "SUCCESS",
          completes: true,
        },
      ],
      comment: null,
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should pass when statusOptions is empty", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      statusOptions: [],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should pass when multiple statusOptions have completes true", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      statusOptions: [
        {
          code: "COMPLETE",
          name: "Complete",
          theme: "SUCCESS",
          completes: true,
        },
        {
          code: "COMPLETE_WITH_NOTES",
          name: "Complete with Notes",
          theme: "SUCCESS",
          completes: true,
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });
});
