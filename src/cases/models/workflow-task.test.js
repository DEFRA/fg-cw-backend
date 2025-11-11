import { describe, expect, it } from "vitest";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";

describe("WorkflowTask", () => {
  describe("validation", () => {
    it("should create a valid task with all required fields", () => {
      const task = new WorkflowTask({
        code: "task-1",
        name: "Test Task",
        type: "boolean",
        description: "A test task",
        statusOptions: [
          new WorkflowTaskStatusOption({
            code: "complete",
            name: "Complete",
            completes: true,
          }),
        ],
      });

      expect(task.code).toBe("task-1");
      expect(task.name).toBe("Test Task");
      expect(task.statusOptions).toHaveLength(1);
    });

    it("should throw error when statusOptions has no completing option", () => {
      expect(
        () =>
          new WorkflowTask({
            code: "task-1",
            name: "Test Task",
            type: "boolean",
            description: "A test task",
            statusOptions: [
              new WorkflowTaskStatusOption({
                code: "in-progress",
                name: "In Progress",
                completes: false,
              }),
            ],
          }),
      ).toThrow("At least one status option must have completes set to true");
    });

    it("should allow multiple status options if at least one completes", () => {
      const task = new WorkflowTask({
        code: "task-1",
        name: "Test Task",
        type: "boolean",
        description: "A test task",
        statusOptions: [
          new WorkflowTaskStatusOption({
            code: "in-progress",
            name: "In Progress",
            completes: false,
          }),
          new WorkflowTaskStatusOption({
            code: "complete",
            name: "Complete",
            completes: true,
          }),
        ],
      });

      expect(task.statusOptions).toHaveLength(2);
    });

    it("should throw error when required field is missing", () => {
      expect(
        () =>
          new WorkflowTask({
            code: "task-1",
            name: "Test Task",
          }),
      ).toThrow(
        'Invalid WorkflowTask: "type" is required, "description" is required, "statusOptions" is required',
      );
    });

    it("should accept null description", () => {
      const task = new WorkflowTask({
        code: "task-1",
        name: "Test Task",
        type: "boolean",
        description: null,
        statusOptions: [
          new WorkflowTaskStatusOption({
            code: "complete",
            name: "Complete",
            completes: true,
          }),
        ],
      });

      expect(task.description).toBeNull();
    });

    it("should accept array description", () => {
      const task = new WorkflowTask({
        code: "task-1",
        name: "Test Task",
        type: "boolean",
        description: ["Step 1", "Step 2"],
        statusOptions: [
          new WorkflowTaskStatusOption({
            code: "complete",
            name: "Complete",
            completes: true,
          }),
        ],
      });

      expect(Array.isArray(task.description)).toBe(true);
      expect(task.description).toHaveLength(2);
    });
  });
});
