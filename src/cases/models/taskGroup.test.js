import { describe, expect, it } from "vitest";
import { Task } from "./task.js";
import { TaskGroup } from "./taskGroup.js";

describe("TaskGroup", () => {
  describe("constructor", () => {
    it("creates task group with all required properties", () => {
      const props = {
        id: "task-group-1",
        tasks: [
          { id: "task-1", status: "pending" },
          { id: "task-2", status: "complete" },
        ],
      };

      const taskGroup = new TaskGroup(props);

      expect(taskGroup.id).toBe("task-group-1");
      expect(taskGroup.tasks).toHaveLength(2);
      expect(taskGroup.tasks[0]).toBeInstanceOf(Task);
      expect(taskGroup.tasks[0].id).toBe("task-1");
      expect(taskGroup.tasks[0].status).toBe("pending");
      expect(taskGroup.tasks[1]).toBeInstanceOf(Task);
      expect(taskGroup.tasks[1].id).toBe("task-2");
      expect(taskGroup.tasks[1].status).toBe("complete");
    });

    it("creates task group with empty tasks array", () => {
      const props = {
        id: "task-group-1",
        tasks: [],
      };

      const taskGroup = new TaskGroup(props);

      expect(taskGroup.id).toBe("task-group-1");
      expect(taskGroup.tasks).toHaveLength(0);
      expect(Array.isArray(taskGroup.tasks)).toBe(true);
    });

    it("creates task group with single task", () => {
      const props = {
        id: "task-group-1",
        tasks: [{ id: "task-1", status: "in_progress" }],
      };

      const taskGroup = new TaskGroup(props);

      expect(taskGroup.id).toBe("task-group-1");
      expect(taskGroup.tasks).toHaveLength(1);
      expect(taskGroup.tasks[0].id).toBe("task-1");
      expect(taskGroup.tasks[0].status).toBe("in_progress");
    });

    it("strips unknown properties", () => {
      const props = {
        id: "task-group-1",
        tasks: [{ id: "task-1", status: "pending" }],
        unknownProperty: "should-be-stripped",
      };

      const taskGroup = new TaskGroup(props);

      expect(taskGroup.id).toBe("task-group-1");
      expect(taskGroup.tasks).toHaveLength(1);
      expect(taskGroup.unknownProperty).toBeUndefined();
    });
  });

  describe("task validation", () => {
    it("validates task properties when creating task group", () => {
      const props = {
        id: "task-group-1",
        tasks: [
          { id: "task-1", status: "pending" },
          { id: "task-2", status: "invalid-status" },
        ],
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "tasks[1].status" must be one of [pending, in_progress, complete]',
      );
    });

    it("validates all tasks in the array", () => {
      const props = {
        id: "task-group-1",
        tasks: [{ id: "task-1", status: "pending" }, { status: "complete" }],
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "tasks[1].id" is required',
      );
    });
  });

  describe("validation errors", () => {
    it("throws error when id is missing", () => {
      const props = {
        tasks: [{ id: "task-1", status: "pending" }],
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "id" is required',
      );
    });

    it("throws error when tasks is missing", () => {
      const props = {
        id: "task-group-1",
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "tasks" is required',
      );
    });

    it("throws error when id is not a string", () => {
      const props = {
        id: 123,
        tasks: [],
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "id" must be a string',
      );
    });

    it("throws error when tasks is not an array", () => {
      const props = {
        id: "task-group-1",
        tasks: "not-an-array",
      };

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "tasks" must be an array',
      );
    });

    it("throws error with multiple validation errors", () => {
      const props = {};

      expect(() => new TaskGroup(props)).toThrowError(
        'Invalid TaskGroupSchema: "id" is required, "tasks" is required',
      );
    });
  });
});
