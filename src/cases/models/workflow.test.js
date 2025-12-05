import { describe, expect, it } from "vitest";
import { Position } from "./position.js";
import { WorkflowActionComment } from "./workflow-action-comment.js";
import { WorkflowAction } from "./workflow-action.js";
import { WorkflowPhase } from "./workflow-phase.js";
import { WorkflowStageStatus } from "./workflow-stage-status.js";
import { WorkflowStage } from "./workflow-stage.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";
import { WorkflowTransition } from "./workflow-transition.js";
import { Workflow } from "./workflow.js";

describe("Workflow", () => {
  const createMockWorkflow = () => {
    return new Workflow({
      _id: "workflow-id",
      code: "test-workflow",
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Initial Review",
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Review application",
                      mandatory: true,
                      description: "Review the application",
                      statusOptions: [
                        new WorkflowTaskStatusOption({
                          code: "COMPLETE",
                          name: "Complete",
                          theme: "SUCCESS",
                          completes: true,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
              statuses: [
                new WorkflowStageStatus({
                  code: "IN_PROGRESS",
                  name: "In Progress",
                  theme: "INFO",
                  transitions: [
                    new WorkflowTransition({
                      targetPosition: Position.from("PHASE_1:STAGE_1:APPROVED"),
                      action: new WorkflowAction({
                        code: "approve",
                        name: "Approve",
                        comment: new WorkflowActionComment({
                          label: "Approval reason",
                          helpText: "Help text",
                          mandatory: false,
                        }),
                      }),
                    }),
                    new WorkflowTransition({
                      targetPosition: Position.from("PHASE_1:STAGE_1:REJECTED"),
                      action: new WorkflowAction({
                        code: "reject",
                        name: "Reject",
                        comment: new WorkflowActionComment({
                          label: "Rejection reason",
                          helpText: "Help reject text",
                          mandatory: true,
                        }),
                      }),
                    }),
                    new WorkflowTransition({
                      targetPosition: Position.from("PHASE_1:STAGE_1:ON_HOLD"),
                      action: new WorkflowAction({
                        code: "on-hold",
                        name: "Put on hold",
                        comment: new WorkflowActionComment({
                          label: "Note (optional)",
                          helpText: "Help optional text",
                          mandatory: false,
                        }),
                      }),
                    }),
                    new WorkflowTransition({
                      targetPosition: Position.from(
                        "PHASE_1:STAGE_1:COMPLETED",
                      ),
                      action: new WorkflowAction({
                        code: "no-comment-action",
                        name: "Action without comment",
                      }),
                    }),
                  ],
                }),
              ],
            }),
            new WorkflowStage({
              code: "STAGE_2",
              name: "Final Decision",
              taskGroups: [],
              statuses: [
                new WorkflowStageStatus({
                  code: "IN_PROGRESS",
                  name: "In Progress",
                  theme: "INFO",
                  transitions: [
                    new WorkflowTransition({
                      targetPosition: Position.from("PHASE_1:STAGE_2:APPROVED"),
                      action: new WorkflowAction({
                        code: "final-approve",
                        name: "Final Approval",
                      }),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
      externalActions: [
        {
          code: "RECALCULATE_RULES",
          name: "Run calculations again",
          description: "Rerun the business rules validation",
          endpoint: "landGrantsRulesRerun",
          display: true,
          target: {
            position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
            targetNode: "landGrantsRulesRun",
            dataType: "ARRAY",
            place: "append",
          },
        },
      ],
    });
  };

  describe("isMissingRequiredComment", () => {
    it("returns true when required comment is missing", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBe(true);
    });

    it("returns true when required comment is empty string", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      const result = workflow.isMissingRequiredComment(action, "");

      expect(result).toBe(true);
    });

    it("returns true when required comment is whitespace only", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      const result = workflow.isMissingRequiredComment(action, "   \t\n   ");

      expect(result).toBe(true);
    });

    it("returns false when required comment is provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      const result = workflow.isMissingRequiredComment(action, "Valid comment");

      expect(result).toBe(false);
    });

    it("returns false when comment is optional and not provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: false } };

      const result = workflow.isMissingRequiredComment(action, null);

      expect(result).toBe(false);
    });

    it("returns false when comment is optional and provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: false } };

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
      const action = { comment: { mandatory: true } };

      expect(() => {
        workflow.validateComment({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "APPROVE",
          action,
          comment: "Valid comment",
        });
      }).not.toThrow();
    });

    it("passes validation when optional comment is not provided", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: false } };

      expect(() => {
        workflow.validateComment({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "on-hold",
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
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "no-comment",
          action,
          comment: null,
        });
      }).not.toThrow();
    });

    it("throws error when required comment is missing", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      expect(() => {
        workflow.validateComment({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "APPROVE",
          action,
          comment: null,
        });
      }).toThrowError(
        'Phase "PHASE_1", Stage "STAGE_1", Action "APPROVE" requires a comment',
      );
    });

    it("throws error when required comment is empty", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      expect(() => {
        workflow.validateComment({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "APPROVE",
          action,
          comment: "",
        });
      }).toThrowError(
        'Phase "PHASE_1", Stage "STAGE_1", Action "APPROVE" requires a comment',
      );
    });

    it("throws error when required comment is whitespace only", () => {
      const workflow = createMockWorkflow();
      const action = { comment: { mandatory: true } };

      expect(() => {
        workflow.validateComment({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          actionCode: "APPROVE",
          action,
          comment: "   \t   ",
        });
      }).toThrowError(
        'Phase "PHASE_1", Stage "STAGE_1", Action "APPROVE" requires a comment',
      );
    });
  });

  describe("validateStageActionComment", () => {
    it("validates successfully with valid stage, action, and comment", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "IN_PROGRESS",
      });

      const result = workflow.validateStageActionComment({
        position,
        actionCode: "approve",
        comment: "Valid approval comment",
      });

      expect(result).toBe(true);
    });

    it("validates successfully with optional comment action", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "IN_PROGRESS",
      });

      const result = workflow.validateStageActionComment({
        position,
        actionCode: "on-hold",
        comment: null,
      });

      expect(result).toBe(true);
    });

    it("validates successfully with action that has no comment requirement", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "IN_PROGRESS",
      });

      const result = workflow.validateStageActionComment({
        position,
        actionCode: "no-comment-action",
        comment: null,
      });

      expect(result).toBe(true);
    });

    it("throws error when stage is not found", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "non-existent-stage",
        statusCode: "IN_PROGRESS",
      });

      expect(() => {
        workflow.validateStageActionComment({
          position,
          actionCode: "approve",
          comment: "Comment",
        });
      }).toThrowError('Stage with code "non-existent-stage" not found');
    });

    it("throws error when required comment is missing", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "IN_PROGRESS",
      });

      expect(() => {
        workflow.validateStageActionComment({
          position,
          actionCode: "reject",
          comment: null,
        });
      }).toThrowError(
        'Phase "PHASE_1", Stage "STAGE_1", Action "reject" requires a comment',
      );
    });

    it("validates multiple different scenarios", () => {
      const workflow = createMockWorkflow();
      const position = new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "IN_PROGRESS",
      });

      // Optional comment not provided (approve has mandatory: false in our mock)
      expect(
        workflow.validateStageActionComment({
          position,
          actionCode: "approve",
          comment: "Approved because criteria met",
        }),
      ).toBe(true);

      // Optional comment not provided
      expect(
        workflow.validateStageActionComment({
          position,
          actionCode: "on-hold",
          comment: null,
        }),
      ).toBe(true);

      // Optional comment provided
      expect(
        workflow.validateStageActionComment({
          position,
          actionCode: "on-hold",
          comment: "Waiting for more information",
        }),
      ).toBe(true);

      // No comment requirement
      expect(
        workflow.validateStageActionComment({
          position,
          actionCode: "no-comment-action",
          comment: null,
        }),
      ).toBe(true);
    });
  });

  describe("integration with findTask method", () => {
    it("uses findStage method in findTask", () => {
      const workflow = createMockWorkflow();

      const task = workflow.findTask({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
      });

      expect(task).toBeDefined();
      expect(task.code).toBe("TASK_1");
    });

    it("throws error from findPhase when phase not found", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.findTask({
          phaseCode: "non-existent-phase",
          stageCode: "STAGE_1",
          taskGroupCode: "TASK_GROUP_1",
          taskCode: "TASK_1",
        });
      }).toThrowError('Phase with code "non-existent-phase" not found');
    });

    it("throws error from findStage when stage not found in findTask", () => {
      const workflow = createMockWorkflow();

      expect(() => {
        workflow.findTask({
          phaseCode: "PHASE_1",
          stageCode: "non-existent-stage",
          taskGroupCode: "TASK_GROUP_1",
          taskCode: "TASK_1",
        });
      }).toThrowError('Stage with code "non-existent-stage" not found');
    });
  });
});
