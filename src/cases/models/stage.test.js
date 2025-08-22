import { beforeEach, describe, expect, it, vi } from "vitest";
import { Stage, toStages } from "./stage.js";
import { TaskGroup } from "./taskGroup.js";

describe("Stage", () => {
  describe("constructor", () => {
    it("creates stage with all required properties", () => {
      const props = {
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [{ id: "task-1", status: "pending" }],
          },
        ],
      };

      const stage = new Stage(props);

      expect(stage.id).toBe("stage-1");
      expect(stage.taskGroups).toHaveLength(1);
      expect(stage.taskGroups[0]).toBeInstanceOf(TaskGroup);
      expect(stage.taskGroups[0].id).toBe("task-group-1");
      expect(stage.outcome).toBeUndefined();
    });

    it("creates stage with outcome", () => {
      const props = {
        id: "stage-1",
        taskGroups: [],
        outcome: {
          actionId: "approve",
          commentRef: "comment-ref-123",
          createdBy: "user-123",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      };

      const stage = new Stage(props);

      expect(stage.id).toBe("stage-1");
      expect(stage.outcome).toEqual({
        actionId: "approve",
        commentRef: "comment-ref-123",
        createdBy: "user-123",
        createdAt: "2025-01-01T00:00:00.000Z",
      });
    });

    it("creates stage with null outcome", () => {
      const props = {
        id: "stage-1",
        taskGroups: [],
        outcome: null,
      };

      const stage = new Stage(props);

      expect(stage.id).toBe("stage-1");
      expect(stage.outcome).toBeNull();
    });

    it("creates stage with multiple task groups", () => {
      const props = {
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [{ id: "task-1", status: "pending" }],
          },
          {
            id: "task-group-2",
            tasks: [{ id: "task-2", status: "complete" }],
          },
        ],
      };

      const stage = new Stage(props);

      expect(stage.taskGroups).toHaveLength(2);
      expect(stage.taskGroups[0].id).toBe("task-group-1");
      expect(stage.taskGroups[1].id).toBe("task-group-2");
    });
  });

  describe("setOutcome", () => {
    let stage;

    beforeEach(() => {
      stage = new Stage({
        id: "stage-1",
        taskGroups: [],
      });
    });

    it("sets outcome with all required properties", () => {
      const mockDate = new Date("2025-01-01T12:00:00.000Z");
      vi.spyOn(global, "Date").mockImplementation(() => mockDate);

      stage.setOutcome({
        actionId: "approve",
        commentRef: "comment-ref-123",
        createdBy: "user-123",
      });

      expect(stage.outcome).toEqual({
        actionId: "approve",
        commentRef: "comment-ref-123",
        createdBy: "user-123",
        createdAt: "2025-01-01T12:00:00.000Z",
      });

      vi.restoreAllMocks();
    });

    it("sets outcome without comment reference", () => {
      const mockDate = new Date("2025-01-01T12:00:00.000Z");
      vi.spyOn(global, "Date").mockImplementation(() => mockDate);

      stage.setOutcome({
        actionId: "reject",
        createdBy: "user-456",
      });

      expect(stage.outcome).toEqual({
        actionId: "reject",
        createdBy: "user-456",
        createdAt: "2025-01-01T12:00:00.000Z",
      });
      expect(stage.outcome.commentRef).toBeUndefined();

      vi.restoreAllMocks();
    });

    it("overwrites existing outcome", () => {
      stage.outcome = {
        actionId: "old-action",
        createdBy: "old-user",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const mockDate = new Date("2025-01-01T12:00:00.000Z");
      vi.spyOn(global, "Date").mockImplementation(() => mockDate);

      stage.setOutcome({
        actionId: "new-action",
        createdBy: "new-user",
      });

      expect(stage.outcome.actionId).toBe("new-action");
      expect(stage.outcome.createdBy).toBe("new-user");
      expect(stage.outcome.createdAt).toBe("2025-01-01T12:00:00.000Z");

      vi.restoreAllMocks();
    });
  });

  describe("allTasksComplete", () => {
    it("returns true when all tasks are complete", () => {
      const stage = new Stage({
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [
              { id: "task-1", status: "complete" },
              { id: "task-2", status: "complete" },
            ],
          },
          {
            id: "task-group-2",
            tasks: [{ id: "task-3", status: "complete" }],
          },
        ],
      });

      expect(stage.allTasksComplete()).toBe(true);
    });

    it("returns false when some tasks are not complete", () => {
      const stage = new Stage({
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [
              { id: "task-1", status: "complete" },
              { id: "task-2", status: "pending" },
            ],
          },
        ],
      });

      expect(stage.allTasksComplete()).toBe(false);
    });

    it("returns false when tasks are in progress", () => {
      const stage = new Stage({
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [{ id: "task-1", status: "in_progress" }],
          },
        ],
      });

      expect(stage.allTasksComplete()).toBe(false);
    });

    it("returns true when no tasks exist", () => {
      const stage = new Stage({
        id: "stage-1",
        taskGroups: [],
      });

      expect(stage.allTasksComplete()).toBe(true);
    });

    it("returns true when task groups have no tasks", () => {
      const stage = new Stage({
        id: "stage-1",
        taskGroups: [
          { id: "task-group-1", tasks: [] },
          { id: "task-group-2", tasks: [] },
        ],
      });

      expect(stage.allTasksComplete()).toBe(true);
    });
  });

  describe("validation errors", () => {
    it("throws error when id is missing", () => {
      const props = {
        taskGroups: [],
      };

      expect(() => new Stage(props)).toThrowError(
        'Invalid StageSchema: "id" is required',
      );
    });

    it("throws error when taskGroups is missing", () => {
      const props = {
        id: "stage-1",
      };

      expect(() => new Stage(props)).toThrowError(
        'Invalid StageSchema: "taskGroups" is required',
      );
    });

    it("throws error when outcome has invalid structure", () => {
      const props = {
        id: "stage-1",
        taskGroups: [],
        outcome: {
          actionId: "approve",
          // missing createdBy
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      };

      expect(() => new Stage(props)).toThrowError(
        'Invalid StageSchema: "outcome.createdBy" is required',
      );
    });

    it("throws error when outcome has invalid date format", () => {
      const props = {
        id: "stage-1",
        taskGroups: [],
        outcome: {
          actionId: "approve",
          createdBy: "user-123",
          createdAt: "invalid-date",
        },
      };

      expect(() => new Stage(props)).toThrowError(
        'Invalid StageSchema: "outcome.createdAt" must be in iso format',
      );
    });
  });
});

describe("toStages", () => {
  it("converts array of stage objects to Stage instances", () => {
    const stagesData = [
      {
        id: "stage-1",
        taskGroups: [
          {
            id: "task-group-1",
            tasks: [{ id: "task-1", status: "pending" }],
          },
        ],
      },
      {
        id: "stage-2",
        taskGroups: [],
      },
    ];

    const stages = toStages(stagesData);

    expect(stages).toHaveLength(2);
    expect(stages[0]).toBeInstanceOf(Stage);
    expect(stages[0].id).toBe("stage-1");
    expect(stages[1]).toBeInstanceOf(Stage);
    expect(stages[1].id).toBe("stage-2");
  });

  it("returns empty array when given null", () => {
    const stages = toStages(null);

    expect(stages).toEqual([]);
  });

  it("returns empty array when given undefined", () => {
    const stages = toStages(undefined);

    expect(stages).toEqual([]);
  });

  it("returns empty array when given empty array", () => {
    const stages = toStages([]);

    expect(stages).toEqual([]);
  });
});
