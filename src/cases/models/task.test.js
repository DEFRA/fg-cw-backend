import { describe, expect, it } from "vitest";
import { Task } from "./task.js";

describe("Task", () => {
  describe("constructor", () => {
    it("creates task with all required properties", () => {
      const props = {
        id: "task-1",
        status: "pending",
      };

      const task = new Task(props);

      expect(task.id).toBe("task-1");
      expect(task.status).toBe("pending");
    });

    it("creates task with different valid status values", () => {
      const pendingTask = new Task({ id: "task-1", status: "pending" });
      const inProgressTask = new Task({ id: "task-2", status: "in_progress" });
      const completeTask = new Task({ id: "task-3", status: "complete" });

      expect(pendingTask.status).toBe("pending");
      expect(inProgressTask.status).toBe("in_progress");
      expect(completeTask.status).toBe("complete");
    });

    it("strips unknown properties", () => {
      const props = {
        id: "task-1",
        status: "pending",
        unknownProperty: "should-be-stripped",
      };

      const task = new Task(props);

      expect(task.id).toBe("task-1");
      expect(task.status).toBe("pending");
      expect(task.unknownProperty).toBeUndefined();
    });
  });

  describe("validation errors", () => {
    it("throws error when id is missing", () => {
      const props = {
        status: "pending",
      };

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "id" is required',
      );
    });

    it("throws error when status is missing", () => {
      const props = {
        id: "task-1",
      };

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "status" is required',
      );
    });

    it("throws error when id is not a string", () => {
      const props = {
        id: 123,
        status: "pending",
      };

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "id" must be a string',
      );
    });

    it("throws error when status is invalid", () => {
      const props = {
        id: "task-1",
        status: "invalid-status",
      };

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "status" must be one of [pending, in_progress, complete]',
      );
    });

    it("throws error when status is empty string", () => {
      const props = {
        id: "task-1",
        status: "",
      };

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "status" must be one of [pending, in_progress, complete]',
      );
    });

    it("throws error with multiple validation errors", () => {
      const props = {};

      expect(() => new Task(props)).toThrowError(
        'Invalid TaskSchema: "id" is required, "status" is required',
      );
    });
  });
});
