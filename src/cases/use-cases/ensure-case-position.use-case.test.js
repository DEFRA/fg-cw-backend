import { describe, expect, it, vi } from "vitest";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Position } from "../models/position.js";
import { Workflow } from "../models/workflow.js";
import {
  createCaseStage,
  createCaseTask,
  createCaseTaskGroup,
  ensureCasePosition,
} from "./ensure-case-position.use-case.js";

describe("createCaseTask", () => {
  it("creates a CaseTask with default empty state", () => {
    const task = createCaseTask({ code: "MY_TASK" });

    expect(task).toBeInstanceOf(CaseTask);
    expect(task.code).toBe("MY_TASK");
    expect(task.status).toBeNull();
    expect(task.completed).toBe(false);
    expect(task.commentRefs).toEqual([]);
    expect(task.updatedAt).toBeNull();
    expect(task.updatedBy).toBeNull();
  });
});

describe("createCaseTaskGroup", () => {
  it("creates a task group with all non-conditional tasks", async () => {
    const taskGroup = {
      code: "GROUP_1",
      tasks: [{ code: "TASK_A" }, { code: "TASK_B" }],
    };

    const result = await createCaseTaskGroup(taskGroup, {});

    expect(result).toBeInstanceOf(CaseTaskGroup);
    expect(result.code).toBe("GROUP_1");
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].code).toBe("TASK_A");
    expect(result.tasks[1].code).toBe("TASK_B");
  });

  it("excludes conditional tasks when condition is not met", async () => {
    const taskGroup = {
      code: "GROUP_1",
      tasks: [
        { code: "TASK_A" },
        {
          code: "TASK_CONDITIONAL",
          conditional: "$.payload.answers[?(@property == 'count' && @ > 10)]",
        },
      ],
    };

    const root = { payload: { answers: { count: 5 } } };
    const result = await createCaseTaskGroup(taskGroup, root);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].code).toBe("TASK_A");
  });

  it("includes conditional tasks when condition is met", async () => {
    const taskGroup = {
      code: "GROUP_1",
      tasks: [
        { code: "TASK_A" },
        {
          code: "TASK_CONDITIONAL",
          conditional: "$.payload.answers[?(@property == 'count' && @ > 10)]",
        },
      ],
    };

    const root = { payload: { answers: { count: 15 } } };
    const result = await createCaseTaskGroup(taskGroup, root);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1].code).toBe("TASK_CONDITIONAL");
  });
});

describe("createCaseStage", () => {
  it("creates a CaseStage with task groups", async () => {
    const stage = {
      code: "STAGE_A",
      taskGroups: [
        {
          code: "GROUP_1",
          tasks: [{ code: "TASK_1" }],
        },
      ],
    };

    const result = await createCaseStage(stage, {});

    expect(result).toBeInstanceOf(CaseStage);
    expect(result.code).toBe("STAGE_A");
    expect(result.taskGroups).toHaveLength(1);
    expect(result.taskGroups[0].tasks[0].code).toBe("TASK_1");
  });
});

describe("ensureCasePosition", () => {
  const buildKase = ({ phases = [], caseRef = "TEST-REF" } = {}) => ({
    caseRef,
    phases,
    hasPhase: vi.fn((code) => phases.some((p) => p.code === code)),
    findPhase: vi.fn((code) => phases.find((p) => p.code === code)),
  });

  const buildWorkflow = () => Workflow.createMock();

  it("does nothing when the target phase and stage already exist", async () => {
    const existingStage = new CaseStage({
      code: "STAGE_1",
      taskGroups: [
        new CaseTaskGroup({
          code: "TG_1",
          tasks: [
            new CaseTask({
              code: "TASK_1",
              status: "COMPLETE",
              completed: true,
            }),
          ],
        }),
      ],
    });
    const existingPhase = new CasePhase({
      code: "PHASE_1",
      stages: [existingStage],
    });

    const kase = buildKase({ phases: [existingPhase] });
    const workflow = buildWorkflow();
    const target = new Position({
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      statusCode: "STATUS_1",
    });

    await ensureCasePosition(kase, workflow, target);

    expect(kase.phases).toHaveLength(1);
    expect(kase.phases[0].stages).toHaveLength(1);
    expect(kase.phases[0].stages[0].taskGroups[0].tasks[0].status).toBe(
      "COMPLETE",
    );
  });

  it("creates a new stage in an existing phase when target stage is missing", async () => {
    const existingStage = new CaseStage({
      code: "STAGE_1",
      taskGroups: [],
    });
    const existingPhase = new CasePhase({
      code: "PHASE_1",
      stages: [existingStage],
    });

    const kase = buildKase({ phases: [existingPhase] });
    const workflow = buildWorkflow();
    const target = new Position({
      phaseCode: "PHASE_1",
      stageCode: "STAGE_2",
      statusCode: "STATUS_1",
    });

    await ensureCasePosition(kase, workflow, target);

    expect(kase.phases).toHaveLength(1);
    expect(existingPhase.stages).toHaveLength(2);
    expect(existingPhase.stages[1].code).toBe("STAGE_2");
  });

  it("creates a new phase with the target stage when phase is missing", async () => {
    const existingPhase = new CasePhase({
      code: "PHASE_1",
      stages: [new CaseStage({ code: "STAGE_1", taskGroups: [] })],
    });

    const kase = buildKase({ phases: [existingPhase] });
    const workflow = buildWorkflow();
    const target = new Position({
      phaseCode: "PHASE_2",
      stageCode: "STAGE_1",
      statusCode: "STATUS_1",
    });

    await ensureCasePosition(kase, workflow, target);

    expect(kase.phases).toHaveLength(2);
    expect(kase.phases[1].code).toBe("PHASE_2");
    expect(kase.phases[1].stages).toHaveLength(1);
    expect(kase.phases[1].stages[0].code).toBe("STAGE_1");
  });

  it("creates tasks with default empty state for new stages", async () => {
    const kase = buildKase({
      phases: [
        new CasePhase({
          code: "PHASE_1",
          stages: [new CaseStage({ code: "STAGE_1", taskGroups: [] })],
        }),
      ],
    });
    const workflow = buildWorkflow();
    const target = new Position({
      phaseCode: "PHASE_1",
      stageCode: "STAGE_2",
      statusCode: "STATUS_1",
    });

    await ensureCasePosition(kase, workflow, target);

    const newStage = kase.phases[0].stages[1];
    expect(newStage.code).toBe("STAGE_2");
  });

  it("preserves existing task data when phase/stage already exists", async () => {
    const existingTask = new CaseTask({
      code: "TASK_1",
      status: "IN_PROGRESS",
      completed: false,
      commentRefs: [{ status: "IN_PROGRESS", ref: "comment-123" }],
      updatedAt: "2025-01-01T00:00:00.000Z",
      updatedBy: "user-1",
    });
    const existingStage = new CaseStage({
      code: "STAGE_1",
      taskGroups: [new CaseTaskGroup({ code: "TG_1", tasks: [existingTask] })],
    });
    const existingPhase = new CasePhase({
      code: "PHASE_1",
      stages: [existingStage],
    });

    const kase = buildKase({ phases: [existingPhase] });
    const workflow = buildWorkflow();
    const target = new Position({
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      statusCode: "STATUS_1",
    });

    await ensureCasePosition(kase, workflow, target);

    const task = kase.phases[0].stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("IN_PROGRESS");
    expect(task.commentRefs).toEqual([
      { status: "IN_PROGRESS", ref: "comment-123" },
    ]);
    expect(task.updatedBy).toBe("user-1");
  });
});
