import { describe, expect, it } from "vitest";
import { CasePhase } from "./case-phase.js";
import { CaseStage } from "./case-stage.js";
import { CaseTaskGroup } from "./case-task-group.js";
import { CaseTask } from "./case-task.js";
import { WorkflowPhase } from "./workflow-phase.js";
import { WorkflowStage } from "./workflow-stage.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";

describe("CasePhase", () => {
  describe("constructor", () => {
    it("should create a phase with code and stages", () => {
      const phase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [],
          }),
        ],
      });

      expect(phase.code).toBe("PHASE_1");
      expect(phase.stages).toHaveLength(1);
      expect(phase.stages[0].code).toBe("STAGE_1");
    });
  });

  describe("findStage", () => {
    it("should find a stage by code", () => {
      const phase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [],
          }),
          new CaseStage({
            code: "STAGE_2",
            taskGroups: [],
          }),
        ],
      });

      const stage = phase.findStage("STAGE_2");

      expect(stage).toBeDefined();
      expect(stage.code).toBe("STAGE_2");
    });

    it("should throw 404 error when stage not found", () => {
      const phase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [],
          }),
        ],
      });

      expect(() => phase.findStage("NONEXISTENT_STAGE")).toThrow(
        "Cannot find Stage with code NONEXISTENT_STAGE",
      );
    });
  });

  describe("getUserIds", () => {
    it("should return user IDs from all stages", () => {
      const phase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_1",
                tasks: [
                  new CaseTask({
                    code: "TASK_1",
                    status: "COMPLETE",
                    updatedBy: "user-123",
                  }),
                ],
              }),
            ],
          }),
          new CaseStage({
            code: "STAGE_2",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_2",
                tasks: [
                  new CaseTask({
                    code: "TASK_2",
                    status: "PENDING",
                    updatedBy: "user-456",
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const userIds = phase.getUserIds();

      expect(userIds).toContain("user-123");
      expect(userIds).toContain("user-456");
      expect(userIds).toHaveLength(2);
    });

    it("should return empty array when no stages have user IDs", () => {
      const phase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [],
          }),
        ],
      });

      const userIds = phase.getUserIds();

      expect(userIds).toEqual([]);
    });
  });

  describe("areTasksComplete", () => {
    it("should return true when all tasks are complete", () => {
      const casePhase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_1",
                tasks: [
                  new CaseTask({
                    code: "TASK_1",
                    status: "COMPLETE",
                    completed: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const workflowPhase = new WorkflowPhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [
          new WorkflowStage({
            code: "STAGE_1",
            name: "Stage 1",
            description: "Stage 1 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_1",
                name: "Task Group 1",
                description: "Task Group 1 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_1",
                    name: "Task 1",
                    description: "Task 1 description",
                    mandatory: true,
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
          }),
        ],
      });

      const result = casePhase.areTasksComplete(workflowPhase);

      expect(result).toBe(true);
    });

    it("should return false when any task is incomplete", () => {
      const casePhase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_1",
                tasks: [
                  new CaseTask({
                    code: "TASK_1",
                    status: "PENDING",
                    completed: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const workflowPhase = new WorkflowPhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [
          new WorkflowStage({
            code: "STAGE_1",
            name: "Stage 1",
            description: "Stage 1 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_1",
                name: "Task Group 1",
                description: "Task Group 1 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_1",
                    name: "Task 1",
                    description: "Task 1 description",
                    mandatory: true,
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
          }),
        ],
      });

      const result = casePhase.areTasksComplete(workflowPhase);

      expect(result).toBe(false);
    });

    it("should return true when all tasks in multiple stages are complete", () => {
      const casePhase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_1",
                tasks: [
                  new CaseTask({
                    code: "TASK_1",
                    status: "COMPLETE",
                    completed: true,
                  }),
                ],
              }),
            ],
          }),
          new CaseStage({
            code: "STAGE_2",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_2",
                tasks: [
                  new CaseTask({
                    code: "TASK_2",
                    status: "COMPLETE",
                    completed: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const workflowPhase = new WorkflowPhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [
          new WorkflowStage({
            code: "STAGE_1",
            name: "Stage 1",
            description: "Stage 1 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_1",
                name: "Task Group 1",
                description: "Task Group 1 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_1",
                    name: "Task 1",
                    description: "Task 1 description",
                    mandatory: true,
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
          }),
          new WorkflowStage({
            code: "STAGE_2",
            name: "Stage 2",
            description: "Stage 2 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_2",
                name: "Task Group 2",
                description: "Task Group 2 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_2",
                    name: "Task 2",
                    description: "Task 2 description",
                    mandatory: true,
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
          }),
        ],
      });

      const result = casePhase.areTasksComplete(workflowPhase);

      expect(result).toBe(true);
    });

    it("should return false when second stage has incomplete tasks", () => {
      const casePhase = new CasePhase({
        code: "PHASE_1",
        stages: [
          new CaseStage({
            code: "STAGE_1",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_1",
                tasks: [
                  new CaseTask({
                    code: "TASK_1",
                    status: "COMPLETE",
                    completed: true,
                  }),
                ],
              }),
            ],
          }),
          new CaseStage({
            code: "STAGE_2",
            taskGroups: [
              new CaseTaskGroup({
                code: "TASK_GROUP_2",
                tasks: [
                  new CaseTask({
                    code: "TASK_2",
                    status: "PENDING",
                    completed: false,
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const workflowPhase = new WorkflowPhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [
          new WorkflowStage({
            code: "STAGE_1",
            name: "Stage 1",
            description: "Stage 1 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_1",
                name: "Task Group 1",
                description: "Task Group 1 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_1",
                    name: "Task 1",
                    description: "Task 1 description",
                    mandatory: true,
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
          }),
          new WorkflowStage({
            code: "STAGE_2",
            name: "Stage 2",
            description: "Stage 2 description",
            statuses: [],
            taskGroups: [
              new WorkflowTaskGroup({
                code: "TASK_GROUP_2",
                name: "Task Group 2",
                description: "Task Group 2 description",
                tasks: [
                  new WorkflowTask({
                    code: "TASK_2",
                    name: "Task 2",
                    description: "Task 2 description",
                    mandatory: true,
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
          }),
        ],
      });

      const result = casePhase.areTasksComplete(workflowPhase);

      expect(result).toBe(false);
    });

    it("should return true when phase has no stages", () => {
      const casePhase = new CasePhase({
        code: "PHASE_1",
        stages: [],
      });

      const workflowPhase = new WorkflowPhase({
        code: "PHASE_1",
        name: "Phase 1",
        stages: [],
      });

      const result = casePhase.areTasksComplete(workflowPhase);

      expect(result).toBe(true);
    });
  });
});
