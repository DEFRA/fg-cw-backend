import { describe, expect, it } from "vitest";
import { Workflow } from "./workflow.js";

describe("Workflow", () => {
  const createMockWorkflow = () => {
    return new Workflow({
      _id: "workflow-id",
      code: "test-workflow",
      stages: [
        {
          code: "stage-1",
          name: "Initial Review",
          taskGroups: [
            {
              id: "task-group-1",
              tasks: [{ id: "task-1", title: "Review application" }],
            },
          ],
          actions: [
            {
              id: "approve",
              label: "Approve",
              comment: {
                label: "Approval reason",
                type: "REQUIRED",
              },
            },
            {
              id: "reject",
              label: "Reject",
              comment: {
                label: "Rejection reason",
                type: "REQUIRED",
              },
            },
            {
              id: "on-hold",
              label: "Put on hold",
              comment: {
                label: "Note (optional)",
                type: "OPTIONAL",
              },
            },
            {
              id: "no-comment-action",
              label: "Action without comment",
            },
          ],
        },
        {
          code: "stage-2",
          name: "Final Decision",
          taskGroups: [],
          actions: [
            {
              id: "final-approve",
              label: "Final Approval",
            },
          ],
        },
      ],
    });
  };

  describe("findStage", () => {
    it("finds stage by id", () => {
      const workflow = createMockWorkflow();

      const stage = workflow.findStage("stage-1");

      expect(stage).toBeDefined();
      expect(stage.code).toBe("stage-1");
      expect(stage.name).toBe("Initial Review");
    });

    it("finds different stages", () => {
      const workflow = createMockWorkflow();

      const stage2 = workflow.findStage("stage-2");

      expect(stage2).toBeDefined();
      expect(stage2.code).toBe("stage-2");
      expect(stage2.name).toBe("Final Decision");
    });

    it("throws error when stage not found", () => {
      const workflow = createMockWorkflow();

      expect(() => workflow.findStage("non-existent")).toThrowError(
        'Stage with code "non-existent" not found',
      );
    });

    it("throws error for null stage code", () => {
      const workflow = createMockWorkflow();

      expect(() => workflow.findStage(null)).toThrowError(
        'Stage with code "null" not found',
      );
    });

    it("throws error for undefined stage code", () => {
      const workflow = createMockWorkflow();

      expect(() => workflow.findStage(undefined)).toThrowError(
        'Stage with code "undefined" not found',
      );
    });
  });

  describe("findAction", () => {
    it("finds action by id in stage", () => {
      const workflow = createMockWorkflow();
      const stage = workflow.findStage("stage-1");

      const action = workflow.findAction(stage, "approve");

      expect(action).toBeDefined();
      expect(action.id).toBe("approve");
      expect(action.label).toBe("Approve");
    });

    it("finds different actions in same stage", () => {
      const workflow = createMockWorkflow();
      const stage = workflow.findStage("stage-1");

      const rejectAction = workflow.findAction(stage, "reject");
      const holdAction = workflow.findAction(stage, "on-hold");

      expect(rejectAction.id).toBe("reject");
      expect(holdAction.id).toBe("on-hold");
    });

    it("finds action in different stage", () => {
      const workflow = createMockWorkflow();
      const stage2 = workflow.findStage("stage-2");

      const action = workflow.findAction(stage2, "final-approve");

      expect(action).toBeDefined();
      expect(action.id).toBe("final-approve");
    });

    it("throws error when action not found", () => {
      const workflow = createMockWorkflow();
      const stage = workflow.findStage("stage-1");

      expect(() => workflow.findAction(stage, "non-existent")).toThrowError(
        'Stage "stage-1" does not contain action with id "non-existent"',
      );
    });

    it("throws error for null action id", () => {
      const workflow = createMockWorkflow();
      const stage = workflow.findStage("stage-1");

      expect(() => workflow.findAction(stage, null)).toThrowError(
        'Stage "stage-1" does not contain action with id "null"',
      );
    });
  });

  describe("isMissingRequiredComment", () => {
    it("returns true when required comment is missing", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBe(true);
    });

    it("returns true when required comment is empty string", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      const result = workflow.isMissingRequiredComment(action, "");

      expect(result).toBe(true);
    });

    it("returns true when required comment is whitespace only", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      const result = workflow.isMissingRequiredComment(action, "   \t\n   ");

      expect(result).toBe(true);
    });

    it("returns false when required comment is provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      const result = workflow.isMissingRequiredComment(action, "Valid comment");

      expect(result).toBe(false);
    });

    it("returns false when comment is optional and not provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "OPTIONAL" } };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBe(false);
    });

    it("returns false when comment is optional and provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "OPTIONAL" } };

      const result = workflow.isMissingRequiredComment(
        action,
        "Optional comment",
      );

      expect(result).toBe(false);
    });

    it("returns false when action has no comment configuration", () => {
      const workflow = createMockWorkflow();
      const action = { id: "no-comment" };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBeFalsy();
    });

    it("returns false when action comment is null", () => {
      const workflow = createMockWorkflow();
      const action = { comment: null };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBeFalsy();
    });
  });

  describe("validateComment", () => {
    it("passes validation when required comment is provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "approve",
          action,
          comment: "Valid comment",
        });
      }).not.toThrow();
    });

    it("passes validation when optional comment is not provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "OPTIONAL" } };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "on-hold",
          action,
          comment: null,
        });
      }).not.toThrow();
    });

    it("passes validation when action has no comment configuration", () => {
      const workflow = createMockWorkflow();
      const action = { id: "no-comment" };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "no-comment",
          action,
          comment: null,
        });
      }).not.toThrow();
    });

    it("throws error when required comment is missing", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "approve",
          action,
          comment: null,
        });
      }).toThrowError('Stage "stage-1", Action "approve" requires a comment');
    });

    it("throws error when required comment is empty", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "approve",
          action,
          comment: "",
        });
      }).toThrowError('Stage "stage-1", Action "approve" requires a comment');
    });

    it("throws error when required comment is whitespace only", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { type: "REQUIRED" } };

      expect(() => {
        workflow.validateComment({
          stageCode: "stage-1",
          actionId: "approve",
          action,
          comment: "   \t   ",
        });
      }).toThrowError('Stage "stage-1", Action "approve" requires a comment');
    });
  });

  describe("validateStageActionComment", () => {
    it("validates successfully with valid stage, action, and comment", () => {
      const workflow = createMockWorkflow();

      const result = workflow.validateStageActionComment({
        stageCode: "stage-1",
        actionId: "approve",
        comment: "Valid approval comment",
      });

      expect(result).toBe(true);
    });

    it("validates successfully with optional comment action", () => {
      const workflow = createMockWorkflow();

      const result = workflow.validateStageActionComment({
        stageCode: "stage-1",
        actionId: "on-hold",
        comment: null,
      });

      expect(result).toBe(true);
    });

    it("validates successfully with action that has no comment requirement", () => {
      const workflow = createMockWorkflow();

      const result = workflow.validateStageActionComment({
        stageCode: "stage-1",
        actionId: "no-comment-action",
        comment: null,
      });

      expect(result).toBe(true);
    });

    it("throws error when stage is not found", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.validateStageActionComment({
          stageCode: "non-existent-stage",
          actionId: "approve",
          comment: "Comment",
        });
      }).toThrowError('Stage with code "non-existent-stage" not found');
    });

    it("throws error when action is not found", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "non-existent-action",
          comment: "Comment",
        });
      }).toThrowError(
        'Stage "stage-1" does not contain action with id "non-existent-action"',
      );
    });

    it("throws error when required comment is missing", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "approve",
          comment: null,
        });
      }).toThrowError('Stage "stage-1", Action "approve" requires a comment');
    });

    it("validates multiple different scenarios", () => {
      const workflow = createMockWorkflow();

      // Required comment provided
      expect(
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "approve",
          comment: "Approved because criteria met",
        }),
      ).toBe(true);

      // Optional comment not provided
      expect(
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "on-hold",
          comment: null,
        }),
      ).toBe(true);

      // Optional comment provided
      expect(
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "on-hold",
          comment: "Waiting for more information",
        }),
      ).toBe(true);

      // No comment requirement
      expect(
        workflow.validateStageActionComment({
          stageCode: "stage-1",
          actionId: "no-comment-action",
          comment: null,
        }),
      ).toBe(true);
    });
  });

  describe("integration with findTask method", () => {
    it("uses findStage method in findTask", () => {
      const workflow = createMockWorkflow();

      const task = workflow.findTask("stage-1", "task-group-1", "task-1");

      expect(task).toBeDefined();
      expect(task.id).toBe("task-1");
    });

    it("throws error from findStage when stage not found in findTask", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.findTask("non-existent-stage", "task-group-1", "task-1");
      }).toThrowError('Stage with code "non-existent-stage" not found');
    });
  });
});
