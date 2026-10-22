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

  describe("fromDefinition", () => {
    const task = (
      code,
      valueOptions = [
        { code: "DONE", name: "Done", theme: "SUCCESS", completes: true },
      ],
    ) => ({
      code,
      name: code,
      mandatory: true,
      description: null,
      valueOptions,
    });

    const definition = (tasks) => ({
      code: "CHECKS",
      name: "Checks",
      description: null,
      tasks,
    });

    it("builds a task group whose tasks are built from their definitions", () => {
      const taskGroup = WorkflowTaskGroup.fromDefinition(
        definition([task("CHECK_ONE"), task("CHECK_TWO")]),
      );

      expect(taskGroup).toBeInstanceOf(WorkflowTaskGroup);
      expect(taskGroup.tasks.map(({ code }) => code)).toEqual([
        "CHECK_ONE",
        "CHECK_TWO",
      ]);
    });

    it("rejects a task code used twice", () => {
      expect(() =>
        WorkflowTaskGroup.fromDefinition(
          definition([task("CHECK_ONE"), task("CHECK_ONE")]),
        ),
      ).toThrow(
        'Invalid WorkflowTaskGroup "CHECKS": "tasks[1]" repeats code "CHECK_ONE"',
      );
    });

    it("rejects a task the task group holds that its own rules reject", () => {
      const done = {
        code: "DONE",
        name: "Done",
        theme: "SUCCESS",
        completes: true,
      };

      expect(() =>
        WorkflowTaskGroup.fromDefinition(
          definition([task("CHECK_ONE", [done, done])]),
        ),
      ).toThrow('Invalid WorkflowTask "CHECK_ONE"');
    });

    it("rejects a task group with no tasks", () => {
      expect(() =>
        WorkflowTaskGroup.fromDefinition(definition(undefined)),
      ).toThrow('Invalid WorkflowTaskGroup "CHECKS": "tasks" is required');
    });
  });
});
