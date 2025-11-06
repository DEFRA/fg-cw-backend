import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTaskStatusOption } from "../models/workflow-task-status-option.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import {
  updateTaskStatusUseCase,
  validatePayloadComment,
} from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("../repositories/workflow.repository.js");

describe("updateTaskStatusUseCase", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("throws if comment payload is not provided but required", () => {
    expect(() => validatePayloadComment(undefined, true)).toThrowError();
  });

  it("does not throw if comment payload is provided", () => {
    expect(() => validatePayloadComment("Hello", true)).not.toThrowError();
  });

  it("does not throw if comment payload is not provided and not required", () => {
    expect(() => validatePayloadComment(undefined, false)).not.toThrowError();
  });

  it("throws if case not found", async () => {
    const workflow = Workflow.createMock();
    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(null);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: "0909990909099990aaee9878",
        stageCode: "stage-1",
        taskGroupCode: "task-group-1",
        taskCode: "task-1",
        status: "complete",
        comment: "This is a note/comment",
        user: mockAuthUser,
      }),
    ).rejects.toThrow('Case with id "0909990909099990aaee9878" not found');
  });

  it("updates the status of a task", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "phase-1",
      stageCode: "stage-1",
      taskGroupCode: "task-group-1",
      taskCode: "task-1",
      status: "status-option-1",
      completed: true,
      comment: "This is a note/comment",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("status-option-1");
    expect(task.commentRef).toBeDefined();
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed flag based on statusOption when statusOptions exist", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "phase-1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "stage-1",
              name: "Stage 1",
              description: "Stage description",
              actions: [],
              statuses: [],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "task-group-1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "task-1",
                      name: "Task 1",
                      type: "boolean",
                      description: "Task description",
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
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "phase-1",
      stageCode: "stage-1",
      taskGroupCode: "task-group-1",
      taskCode: "task-1",
      status: "complete",
      completed: false,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("complete");
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed to false when statusOption has completes false", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "phase-1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "stage-1",
              name: "Stage 1",
              description: "Stage description",
              actions: [],
              statuses: [],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "task-group-1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "task-1",
                      name: "Task 1",
                      type: "boolean",
                      description: "Task description",
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
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "phase-1",
      stageCode: "stage-1",
      taskGroupCode: "task-group-1",
      taskCode: "task-1",
      status: "in-progress",
      completed: true,
      comment: "Task in progress",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("in-progress");
    expect(task.completed).toBe(false);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws error when invalid status option is provided", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "phase-1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "stage-1",
              name: "Stage 1",
              description: "Stage description",
              actions: [],
              statuses: [],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "task-group-1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "task-1",
                      name: "Task 1",
                      type: "boolean",
                      description: "Task description",
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
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "phase-1",
        stageCode: "stage-1",
        taskGroupCode: "task-group-1",
        taskCode: "task-1",
        status: "invalid-status",
        completed: true,
        comment: "Task completed",
        user: mockAuthUser,
      }),
    ).rejects.toThrow(
      'Invalid status option "invalid-status" for task "task-1". Valid options are: in-progress, complete',
    );
  });

  it("uses completed parameter when task has no statusOptions", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "phase-1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "stage-1",
              name: "Stage 1",
              description: "Stage description",
              actions: [],
              statuses: [],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "task-group-1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "task-1",
                      name: "Task 1",
                      type: "boolean",
                      description: "Task description",
                      statusOptions: [],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "phase-1",
      stageCode: "stage-1",
      taskGroupCode: "task-group-1",
      taskCode: "task-1",
      status: null,
      completed: true,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe(null);
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });
});
