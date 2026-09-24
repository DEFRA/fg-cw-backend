import { describe, expect, it } from "vitest";
import { WorkflowTaskGroup } from "./workflow-task-group.js";

describe("WorkflowTaskGroup", () => {
  describe("hasTask", () => {
    it("returns true when the task exists", () => {
      const taskGroup = WorkflowTaskGroup.createMock();

      expect(taskGroup.hasTask("TASK_1")).toBe(true);
    });

    it("returns false when the task does not exist", () => {
      const taskGroup = WorkflowTaskGroup.createMock();

      expect(taskGroup.hasTask("TASK_SITI_REFERENCE")).toBe(false);
    });
  });

  describe("findTask", () => {
    it("returns the task when it exists", () => {
      const taskGroup = WorkflowTaskGroup.createMock();

      expect(taskGroup.findTask("TASK_1").code).toBe("TASK_1");
    });

    it("throws a 404 when the task does not exist", () => {
      const taskGroup = WorkflowTaskGroup.createMock();

      expect(() => taskGroup.findTask("TASK_SITI_REFERENCE")).toThrow(
        'Task with code "TASK_SITI_REFERENCE" not found',
      );
    });
  });
});
