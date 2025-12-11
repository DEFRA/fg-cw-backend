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
});
