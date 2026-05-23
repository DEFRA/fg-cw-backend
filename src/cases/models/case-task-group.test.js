import { describe, expect, it } from "vitest";
import { CaseTaskGroup } from "./case-task-group.js";
import { CaseTask } from "./case-task.js";
import { RequiredAppRoles } from "./required-app-roles.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";

describe("CaseTaskGroup", () => {
  describe("constructor", () => {
    it("should create a task group with code and tasks", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({
            code: "TASK_1",
            status: "PENDING",
          }),
        ],
      });

      expect(taskGroup.code).toBe("TASK_GROUP_1");
      expect(taskGroup.tasks).toHaveLength(1);
      expect(taskGroup.tasks[0].code).toBe("TASK_1");
    });
  });

  describe("hasTask", () => {
    it("should return true when task code is present", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "PENDING" }),
          new CaseTask({ code: "TASK_2", status: "PENDING" }),
        ],
      });

      expect(taskGroup.hasTask("TASK_1")).toBe(true);
      expect(taskGroup.hasTask("TASK_2")).toBe(true);
    });

    it("should return false when task code is absent", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [new CaseTask({ code: "TASK_1", status: "PENDING" })],
      });

      expect(taskGroup.hasTask("NON_EXISTENT_TASK")).toBe(false);
    });

    it("should return false when tasks array is empty", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [],
      });

      expect(taskGroup.hasTask("ANY_TASK")).toBe(false);
    });
  });

  describe("findTask", () => {
    it("should return the task when found", () => {
      const task = new CaseTask({ code: "TASK_1", status: "PENDING" });
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [task],
      });

      const foundTask = taskGroup.findTask("TASK_1");

      expect(foundTask).toBe(task);
      expect(foundTask.code).toBe("TASK_1");
    });

    it("should throw Boom.notFound when task is not found", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [new CaseTask({ code: "TASK_1", status: "PENDING" })],
      });

      expect(() => taskGroup.findTask("NON_EXISTENT_TASK")).toThrow(
        "Cannot find Task with code NON_EXISTENT_TASK",
      );
    });
  });

  describe("getUserIds", () => {
    it("should return flat list of updatedBy IDs across tasks", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({
            code: "TASK_1",
            status: "PENDING",
            updatedBy: "user-id-1",
          }),
          new CaseTask({
            code: "TASK_2",
            status: "PENDING",
            updatedBy: "user-id-2",
          }),
        ],
      });

      expect(taskGroup.getUserIds()).toEqual(["user-id-1", "user-id-2"]);
    });

    it("should return empty array when tasks array is empty", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [],
      });

      expect(taskGroup.getUserIds()).toEqual([]);
    });

    it("should filter out undefined updatedBy values", () => {
      const taskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({
            code: "TASK_1",
            status: "PENDING",
            updatedBy: "user-id-1",
          }),
          new CaseTask({
            code: "TASK_2",
            status: "PENDING",
          }),
        ],
      });

      const userIds = taskGroup.getUserIds();
      expect(userIds).toContain("user-id-1");
    });
  });

  describe("isComplete", () => {
    const createWorkflowTask = (code, mandatory = true) =>
      new WorkflowTask({
        code,
        name: `Task ${code}`,
        description: `${code} description`,
        mandatory,
        statusOptions: [
          new WorkflowTaskStatusOption({
            code: "ACCEPTED",
            name: "Accept",
            theme: "SUCCESS",
            completes: true,
          }),
        ],
        requiredRoles: new RequiredAppRoles({ allOf: [], anyOf: [] }),
      });

    it("should return true when all workflow tasks are present and complete", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "ACCEPTED", completed: true }),
          new CaseTask({ code: "TASK_2", status: "ACCEPTED", completed: true }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [createWorkflowTask("TASK_1"), createWorkflowTask("TASK_2")],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(true);
    });

    it("should return false when a mandatory present task is not completed", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "ACCEPTED", completed: true }),
          new CaseTask({ code: "TASK_2", status: "PENDING", completed: false }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [createWorkflowTask("TASK_1"), createWorkflowTask("TASK_2")],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(false);
    });

    it("should skip workflow tasks absent from the case (conditionally excluded) and return true", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "ACCEPTED", completed: true }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [
          createWorkflowTask("TASK_1"),
          createWorkflowTask("CONDITIONAL_TASK"),
        ],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(true);
    });

    it("should return false when a workflow task is absent but a present mandatory task is incomplete", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "PENDING", completed: false }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [
          createWorkflowTask("TASK_1"),
          createWorkflowTask("CONDITIONAL_TASK"),
        ],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(false);
    });

    it("should return true when all tasks are conditionally excluded (empty case task group)", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [createWorkflowTask("CONDITIONAL_TASK_1")],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(true);
    });

    it("should return true for non-mandatory task that is not completed", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "PENDING", completed: false }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [createWorkflowTask("TASK_1", false)],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(true);
    });

    it("should handle mixed mandatory and non-mandatory tasks correctly", () => {
      const caseTaskGroup = new CaseTaskGroup({
        code: "TASK_GROUP_1",
        tasks: [
          new CaseTask({ code: "TASK_1", status: "ACCEPTED", completed: true }),
          new CaseTask({ code: "TASK_2", status: "PENDING", completed: false }),
        ],
      });

      const workflowTaskGroup = new WorkflowTaskGroup({
        code: "TASK_GROUP_1",
        name: "Task Group 1",
        description: "Description",
        tasks: [
          createWorkflowTask("TASK_1", true),
          createWorkflowTask("TASK_2", false),
        ],
      });

      expect(caseTaskGroup.isComplete(workflowTaskGroup)).toBe(true);
    });
  });
});
