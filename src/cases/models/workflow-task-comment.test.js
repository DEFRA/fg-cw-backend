import { describe, expect, it } from "vitest";
import { WorkflowTaskComment } from "./workflow-task-comment.js";

describe("WorkflowTaskComment", () => {
  it("should create a workflow task comment with all fields", () => {
    const comment = new WorkflowTaskComment({
      label: "Task Note",
      helpText: "Please provide details",
      mandatory: true,
    });

    expect(comment.label).toBe("Task Note");
    expect(comment.helpText).toBe("Please provide details");
    expect(comment.mandatory).toBe(true);
  });

  it("should create a workflow task comment with an object label", () => {
    const comment = new WorkflowTaskComment({
      label: { text: "Reason for termination", classes: "govuk-label--s" },
      helpText: "You must include an explanation for auditing purposes.",
      mandatory: true,
    });

    expect(comment.label).toEqual({
      text: "Reason for termination",
      classes: "govuk-label--s",
    });
    expect(comment.helpText).toBe(
      "You must include an explanation for auditing purposes.",
    );
    expect(comment.mandatory).toBe(true);
  });
});
