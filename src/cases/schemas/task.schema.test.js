import { describe, expect, it } from "vitest";
import { Task } from "./task.schema.js";

describe("Task Schema", () => {
  it("should allow missing optional comment", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
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
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [],
      comment: {
        type: "CONDITIONAL",
        helpText: "Please provide a note",
      },
    };

    const { error } = Task.validate(task);

    expect(error.details[0].message).toBe('"comment.label" is required');
  });

  it("should have helpText if comment is provided", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [],
      comment: {
        type: "CONDITIONAL",
        label: "Note",
      },
    };

    const { error } = Task.validate(task);

    expect(error.details[0].message).toBe('"comment.helpText" is required');
  });

  it("should validate allowed types", () => {
    const types = ["CONDITIONAL", "REQUIRED", "OPTIONAL"];
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [],
      comment: {
        type: "CONDITIONAL",
        label: "Note",
        helpText: "Please provide a note",
      },
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    };

    types.forEach((type) => {
      task.comment.type = type;
      const { error } = Task.validate(task);
      expect(error).toBeUndefined();
    });
  });

  it("should error with unknown comment type", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [],
      comment: {
        type: "NOT_ALLOWED_TYPE",
        label: "Note",
        helpText: "Please provide a note",
      },
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe(
      '"comment.type" must be one of [CONDITIONAL, REQUIRED, OPTIONAL]',
    );
  });

  it("should allow null comment", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [
        {
          code: "complete",
          name: "Complete",
          completes: true,
        },
      ],
      comment: null,
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should require at least one statusOption with completes true", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [
        {
          code: "in-progress",
          name: "In Progress",
          completes: false,
        },
        {
          code: "blocked",
          name: "Blocked",
          completes: false,
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeDefined();
    expect(error.message).toBe(
      "At least one status option must have completes set to true",
    );
  });

  it("should pass when at least one statusOption has completes true", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [
        {
          code: "in-progress",
          name: "In Progress",
          completes: false,
        },
        {
          code: "complete",
          name: "Complete",
          completes: true,
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should pass when statusOptions is empty", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should pass when multiple statusOptions have completes true", () => {
    const task = {
      code: "abcd-0987-hjyg-8765-6542",
      name: "Test task",
      type: "boolean",
      description: null,
      statusOptions: [
        {
          code: "complete",
          name: "Complete",
          completes: true,
        },
        {
          code: "complete-with-notes",
          name: "Complete with Notes",
          completes: true,
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });
});
