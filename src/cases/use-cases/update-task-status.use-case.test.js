import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { AppRole } from "../../users/models/app-role.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTaskValueOption } from "../models/workflow-task-value-option.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { resolveWorkflowForCase } from "./resolve-current-workflow.use-case.js";
import {
  updateTaskStatusUseCase,
  validatePayloadComment,
} from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("./resolve-current-workflow.use-case.js");

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
    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(null);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: "0909990909099990aaee9878",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: "COMPLETE",
        comment: "This is a note/comment",
        user: mockAuthUser,
      }),
    ).rejects.toThrow('Case with id "0909990909099990aaee9878" not found');
  });

  it("updates the value of a task", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "STATUS_OPTION_1",
      completed: true,
      comment: "This is a note/comment",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.value).toBe("STATUS_OPTION_1");
    expect(task.commentRefs).toHaveLength(1);
    expect(task.commentRefs[0].value).toBe("STATUS_OPTION_1");
    expect(task.commentRefs[0].ref).toBeDefined();
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws forbidden when user does not have ReadWrite role", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
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
        value: "STATUS_OPTION_1",
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
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
        value: "STATUS_OPTION_1",
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
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
      value: "STATUS_OPTION_1",
      completed: true,
      comment: "This is a note/comment",
      user,
    });

    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed flag based on valueOption when valueOptions exist", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [
                        new WorkflowTaskValueOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
                        new WorkflowTaskValueOption({
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "COMPLETE",
      completed: false,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.value).toBe("COMPLETE");
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("sets completed to false when valueOption has completes false", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [
                        new WorkflowTaskValueOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
                        new WorkflowTaskValueOption({
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "IN_PROGRESS",
      completed: true,
      comment: "Task in progress",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.value).toBe("IN_PROGRESS");
    expect(task.completed).toBe(false);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws error when invalid valueOption is provided", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [
                        new WorkflowTaskValueOption({
                          code: "IN_PROGRESS",
                          name: "In Progress",
                          theme: "INFO",
                          completes: false,
                        }),
                        new WorkflowTaskValueOption({
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: "invalid-status",
        completed: true,
        comment: "Task completed",
        user: mockAuthUser,
      }),
    ).rejects.toThrow(
      'Invalid value option "invalid-status" for task "TASK_1". Valid options are: IN_PROGRESS, COMPLETE',
    );
  });

  it("uses completed parameter when task has no valueOptions", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [],
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: null,
      completed: true,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.value).toBe(null);
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });

  it("throws error when trying to update task value when current stage value is not interactive", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [],
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: null,
        completed: true,
        comment: "Task completed",
        user: mockAuthUser,
      }),
    ).rejects.toThrow(
      "The task TASK_GROUP_1/TASK_1 cannot be modified while case is in PHASE_1:STAGE_1:STATUS_1",
    );
  });

  it("allows task update when current stage value is interactive", async () => {
    const { WorkflowStageStatus } =
      await import("../models/workflow-stage-status.js");
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
                      valueOptions: [],
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

    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: null,
      completed: true,
      comment: "Task completed",
      user: mockAuthUser,
    });

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.value).toBe(null);
    expect(task.completed).toBe(true);
    expect(update).toHaveBeenCalledWith(kase);
  });

  describe("input tasks", () => {
    const setUpInputTask = async (input) => {
      const { WorkflowStageStatus } =
        await import("../models/workflow-stage-status.js");
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
                        input,
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

      resolveWorkflowForCase.mockResolvedValue({
        workflow,
        resolvedVersion: null,
      });
      findById.mockResolvedValue(kase);

      return kase;
    };

    const updateValue = (kase, value) =>
      updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value,
        completed: false,
        user: mockAuthUser,
      });

    const taskOf = (kase) => kase.phases[0].stages[0].taskGroups[0].tasks[0];

    it("infers completed when a text value satisfies pattern and maxlength", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[A-Z]{2}[0-9]{4}",
        maxlength: 6,
      });

      await updateValue(kase, "AB1234");

      expect(taskOf(kase).value).toBe("AB1234");
      expect(taskOf(kase).completed).toBe(true);
    });

    it("rejects a text value that exceeds maxlength", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
        maxlength: 6,
      });

      await expect(() => updateValue(kase, "ABCDEFG")).rejects.toThrow(
        'Invalid value "ABCDEFG" for task "TASK_1": must be 6 characters or fewer',
      );
    });

    it("rejects a text value that does not match the pattern", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[A-Z]{2}[0-9]{4}",
      });

      await expect(() => updateValue(kase, "ab1234")).rejects.toThrow(
        "must match the pattern [A-Z]{2}[0-9]{4}",
      );
    });

    it("matches the pattern against the whole value", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[0-9]{6}",
      });

      await expect(() => updateValue(kase, "xxx123456xxx")).rejects.toThrow(
        "must match the pattern [0-9]{6}",
      );
    });

    it("infers completed when a number value is within min and max", async () => {
      const kase = await setUpInputTask({
        type: "number",
        label: "Capture reference number",
        min: 1000000,
        max: 9999999,
      });

      await updateValue(kase, "1234567");

      expect(taskOf(kase).value).toBe("1234567");
      expect(taskOf(kase).completed).toBe(true);
    });

    it("rejects a number value below min", async () => {
      const kase = await setUpInputTask({
        type: "number",
        label: "Capture reference number",
        min: 1000000,
      });

      await expect(() => updateValue(kase, "999")).rejects.toThrow(
        "must be 1000000 or more",
      );
    });

    it("rejects a number value above max", async () => {
      const kase = await setUpInputTask({
        type: "number",
        label: "Capture reference number",
        max: 100,
      });

      await expect(() => updateValue(kase, "101")).rejects.toThrow(
        "must be 100 or less",
      );
    });

    it("rejects a non-numeric value for a number input", async () => {
      const kase = await setUpInputTask({
        type: "number",
        label: "Capture reference number",
      });

      await expect(() => updateValue(kase, "12abc")).rejects.toThrow(
        "must be a number",
      );
    });

    it("infers completed for a valid date value", async () => {
      const kase = await setUpInputTask({
        type: "date",
        label: "Capture inspection date",
      });

      await updateValue(kase, "2026-07-14");

      expect(taskOf(kase).value).toBe("2026-07-14");
      expect(taskOf(kase).completed).toBe(true);
    });

    it("rejects a date that is not in YYYY-MM-DD format", async () => {
      const kase = await setUpInputTask({
        type: "date",
        label: "Capture inspection date",
      });

      await expect(() => updateValue(kase, "14/07/2026")).rejects.toThrow(
        "must be a valid date in YYYY-MM-DD format",
      );
    });

    it("rejects a date that does not exist in the calendar", async () => {
      const kase = await setUpInputTask({
        type: "date",
        label: "Capture inspection date",
      });

      await expect(() => updateValue(kase, "2026-02-30")).rejects.toThrow(
        "must be a valid date in YYYY-MM-DD format",
      );
    });

    it("un-completes the task when the value is cleared", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
      });

      await updateValue(kase, "AB1234");
      expect(taskOf(kase).completed).toBe(true);

      await updateValue(kase, null);

      expect(taskOf(kase).value).toBe(null);
      expect(taskOf(kase).completed).toBe(false);
    });

    it("treats a whitespace-only value as empty", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
        pattern: "[A-Z]{2}[0-9]{4}",
      });

      await updateValue(kase, "   ");

      expect(taskOf(kase).completed).toBe(false);
    });

    it("ignores the client-supplied completed flag for input tasks", async () => {
      const kase = await setUpInputTask({
        type: "text",
        label: "Capture Siti/FC reference",
      });

      await updateTaskStatusUseCase({
        caseId: kase._id,
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: null,
        completed: true,
        user: mockAuthUser,
      });

      expect(taskOf(kase).completed).toBe(false);
    });
  });
});
