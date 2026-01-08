import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { AppRole } from "../../users/models/app-role.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
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
  const mockAuthUser = User.createMock({
    id: new ObjectId().toHexString(),
    idpRoles: [IdpRoles.ReadWrite],
  });

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
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "COMPLETE",
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
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "STATUS_OPTION_1",
      completed: true,
      comment: "This is a note/comment",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("STATUS_OPTION_1");
    expect(task.commentRef).toBeDefined();
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws forbidden when user does not have ReadWrite role", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    const user = User.createMock({
      id: "test-user-id",
      idpRoles: [IdpRoles.Read],
    });

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "STATUS_OPTION_1",
        completed: true,
        comment: "This is a note/comment",
        user,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );
  });

  it("throws forbidden when user does not have required task roles", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    const user = User.createMock({
      id: "test-user-id",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "2025-07-01",
          endDate: "2100-01-01",
        }),
      },
    });

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "STATUS_OPTION_1",
        completed: true,
        comment: "This is a note/comment",
        user,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );
  });

  it("allows task update when task requiredRoles is null", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    workflow.phases[0].stages[0].taskGroups[0].tasks[0].requiredRoles = null;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    const user = User.createMock({
      id: new ObjectId().toHexString(),
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {},
    });

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "STATUS_OPTION_1",
      completed: true,
      comment: "This is a note/comment",
      user,
    });

    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed flag based on statusOption when statusOptions exist", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
                      description: "Task description",
                      statusOptions: [
                        new WorkflowTaskStatusOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
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
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "COMPLETE",
      completed: false,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("COMPLETE");
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed to false when statusOption has completes false", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
                      description: "Task description",
                      statusOptions: [
                        new WorkflowTaskStatusOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
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
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "IN_PROGRESS",
      completed: true,
      comment: "Task in progress",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("IN_PROGRESS");
    expect(task.completed).toBe(false);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws error when invalid status option is provided", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
                      description: "Task description",
                      statusOptions: [
                        new WorkflowTaskStatusOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
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
        }),
      ],
    });
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "invalid-status",
        completed: true,
        comment: "Task completed",
        user: mockAuthUser,
      }),
    ).rejects.toThrow(
      'Invalid status option "invalid-status" for task "TASK_1". Valid options are: IN_PROGRESS, COMPLETE',
    );
  });

  it("uses completed parameter when task has no statusOptions", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
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
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
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

  it("throws error when trying to update task status when current stage status is not interactive", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Not Interactive Status",
                  theme: "NEUTRAL",
                  description: "Status description",
                  interactive: false,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
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

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: null,
        completed: true,
        comment: "Task completed",
        user: mockAuthUser,
      }),
    ).rejects.toThrow(
      "The task TASK_GROUP_1/TASK_1 cannot be modified while case is in PHASE_1:STAGE_1:STATUS_1",
    );
  });

  it("allows task update when current stage status is interactive", async () => {
    const { WorkflowStageStatus } = await import(
      "../models/workflow-stage-status.js"
    );
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
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
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
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
