import { describe, expect, it } from "vitest";
import { Task } from "./task.schema.js";

describe("Task Schema", () => {
  it("should allow missing optional comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      valueOptions: [],
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
      valueOptions: [],
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
      valueOptions: [],
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
      valueOptions: [],
      comment: {
        label: "Note",
        helpText: "Please provide a note",
      },
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe('"comment.mandatory" is required');
  });

  it("should allow object label in comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      valueOptions: [],
      comment: {
        label: { text: "Reason for termination", classes: "govuk-label--s" },
        helpText: "You must include an explanation for auditing purposes.",
        mandatory: true,
      },
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should allow null comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      description: null,
      mandatory: true,
      valueOptions: [
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

  it("should pass when valueOptions is empty", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      valueOptions: [],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should error when valueOptions is empty and input is also provided", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      valueOptions: [],
      input: {
        type: "text",
        label: "Capture Siti/FC reference",
      },
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe(
      '"value" contains a conflict between exclusive peers [input, valueOptions]',
    );
  });

  // The pattern is compiled per request as `^(?:<pattern>)$`. Catching a
  // malformed one here means a bad config fails when the workflow is saved,
  // rather than as a 500 every time a caseworker sets a value.
  it("should error when the input pattern is not a valid regular expression", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      input: {
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[A-Z",
      },
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe(
      '"input.pattern" must be a valid regular expression',
    );
  });

  it("should allow object label on an input", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      input: {
        type: "text",
        label: {
          text: "Enter SitiAgri reference",
          classes: "govuk-label--m",
        },
      },
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should error when an object input label has no text", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      input: {
        type: "text",
        label: { classes: "govuk-label--m" },
      },
    };

    const { error } = Task.validate(task);
    expect(error).toBeDefined();
  });

  it("should accept a valid input pattern", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      input: {
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[A-Z]{2}[0-9]{6}",
      },
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should accept integer on a number input", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      input: {
        type: "number",
        label: "Capture herd size",
        min: 1,
        max: 5000,
        integer: true,
      },
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it.each(["text", "date"])(
    "should error when integer is set on a %s input",
    (type) => {
      const task = {
        code: "TASK_1",
        name: "Test task",
        mandatory: true,
        description: null,
        input: {
          type,
          label: "Capture something",
          integer: true,
        },
      };

      const { error } = Task.validate(task);
      expect(error.details[0].message).toBe('"input.integer" is not allowed');
    },
  );

  it("should error when neither valueOptions nor input is provided", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
    };

    const { error } = Task.validate(task);
    expect(error.details[0].message).toBe(
      '"value" must contain at least one of [input, valueOptions]',
    );
  });

  it("should pass when multiple valueOptions have completes true", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      valueOptions: [
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

  it("should allow value option comment object", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      valueOptions: [
        {
          code: "COMPLETE",
          name: "Complete",
          theme: "SUCCESS",
          completes: true,
          comment: {
            label: "Reason",
            helpText: "Provide reason",
            mandatory: true,
          },
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });

  it("should allow null value option comment", () => {
    const task = {
      code: "TASK_1",
      name: "Test task",
      mandatory: true,
      description: null,
      valueOptions: [
        {
          code: "COMPLETE",
          name: "Complete",
          theme: "SUCCESS",
          completes: true,
          comment: null,
        },
      ],
    };

    const { error } = Task.validate(task);
    expect(error).toBeUndefined();
  });
});
